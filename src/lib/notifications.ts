// Browser notification scheduler. Fires alerts at the offsets configured on
// each event (default -30 / -10 / 0 minutes). Polls every 20s while the tab is
// open.
//
// IMPORTANT: iOS Safari PWAs do NOT support `new Notification()`. They require
// `serviceWorkerRegistration.showNotification()` instead. This manager uses
// the service worker API when available, falling back to `new Notification()`
// for desktop/Android.

import type { CalendarEvent } from "./types";

const POLL_MS = 20_000;

type AlertCb = (eventId: string, offsetMins: number) => void;

class NotificationManager {
  private events: CalendarEvent[] = [];
  private fired = new Set<string>(); // `${eventId}|${offset}|${fireAt}`
  private timer: ReturnType<typeof setInterval> | null = null;
  private onAlert: AlertCb | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor() {
    // Cache the service worker registration + register periodic sync + web push.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        this.swRegistration = reg;
        this.registerPeriodicSync(reg);
        this.subscribeToPush(reg);
      });
      navigator.serviceWorker.ready.then((reg) => {
        this.swRegistration = reg;
        this.registerPeriodicSync(reg);
        this.subscribeToPush(reg);
      });
    }
  }

  // Register periodic background sync so alerts fire even when the PWA is closed.
  private async registerPeriodicSync(reg: ServiceWorkerRegistration | null) {
    if (!reg) return;
    try {
      if ("periodicSync" in reg) {
        const status = await (reg as any).periodicSync.getPermissionState?.();
        if (status === "granted") {
          await (reg as any).periodicSync.register("check-alerts", {
            minInterval: 15 * 60 * 1000,
          });
        }
      }
    } catch {
      // periodicSync not supported
    }
  }

  // Subscribe to VAPID web push so the server can send push notifications
  // even when the PWA is completely closed. This works on iOS Safari PWA 16.4+.
  private async subscribeToPush(reg: ServiceWorkerRegistration | null) {
    if (!reg) return;
    try {
      console.log("[notifications] Checking for existing push subscription...");
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        console.log("[notifications] ✅ Already subscribed to push — endpoint:", existing.endpoint.substring(0, 60));
        // Re-send to server in case it was lost (e.g. DB was reset)
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: existing.endpoint,
            keys: {
              p256dh: this.arrayBufferToBase64(existing.getKey("p256dh")),
              auth: this.arrayBufferToBase64(existing.getKey("auth")),
            },
          }),
        }).then(r => console.log("[notifications] Re-sent subscription to server:", r.status))
          .catch(e => console.warn("[notifications] Failed to re-send subscription:", String(e)));
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.warn("[notifications] ⚠️ NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — push notifications disabled");
        return;
      }
      console.log("[notifications] VAPID key found, subscribing to push...");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey),
      });

      console.log("[notifications] ✅ Subscribed to push — endpoint:", sub.endpoint.substring(0, 60));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(sub.getKey("p256dh")),
            auth: this.arrayBufferToBase64(sub.getKey("auth")),
          },
        }),
      });
      const data = await res.json();
      console.log("[notifications] Server stored subscription — total:", data.totalSubscriptions);
    } catch (e) {
      console.error("[notifications] ❌ Push subscription failed:", String(e));
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return "";
    const bytes = new Uint8Array(buffer);
    let str = "";
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str);
  }

  setEvents(events: CalendarEvent[]) {
    this.events = events;
    // Keep fired set bounded — only remember alerts from the last 2 hours.
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const key of Array.from(this.fired)) {
      const ts = Number(key.split("|")[2] || 0);
      if (ts < cutoff) this.fired.delete(key);
    }
    this.tick();
  }

  setAlertCallback(cb: AlertCb | null) {
    this.onAlert = cb;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), POLL_MS);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick() {
    const now = Date.now();
    for (const ev of this.events) {
      const startMs = new Date(ev.start).getTime();
      for (const offset of ev.alerts ?? []) {
        const fireAt = startMs + offset * 60 * 1000;
        const key = `${ev.id}|${offset}|${fireAt}`;
        if (fireAt <= now && now - fireAt < 90_000 && !this.fired.has(key)) {
          this.fired.add(key);
          this.fire(ev, offset);
        }
      }
    }
  }

  private fire(ev: CalendarEvent, offsetMins: number) {
    const when =
      offsetMins === 0
        ? "starts now"
        : `starts in ${Math.abs(offsetMins)} min`;
    const title = `${ev.title} ${when}`;
    const body = [ev.location ? `📍 ${ev.location}` : null, offsetMins === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offsetMins)} minutes.`]
      .filter(Boolean)
      .join(" · ");

    this.showNotification(title, {
      body,
      tag: `${ev.id}-${offsetMins}`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { id: ev.id },
    });
    this.onAlert?.(ev.id, offsetMins);
  }

  // Show a notification using the best available API:
  //   1. Service Worker (required for iOS Safari PWA, works when tab is backgrounded)
  //   2. new Notification() (desktop Chrome/Firefox, Android)
  async showNotification(title: string, options?: NotificationOptions & { tag?: string; data?: unknown }) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    // Try service worker first (iOS PWA requires this).
    if (this.swRegistration) {
      try {
        await this.swRegistration.showNotification(title, options);
        return;
      } catch {
        // fall through to new Notification()
      }
    }

    // Fallback: try to get SW registration on-the-fly.
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          this.swRegistration = reg;
          await reg.showNotification(title, options);
          return;
        }
      } catch {
        // fall through
      }
    }

    // Last resort: new Notification() (desktop/Android).
    try {
      new Notification(title, options as NotificationOptions);
    } catch {
      // silently fail — no notification API available
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }

  // Send a test notification (used by the Settings dialog).
  async sendTest() {
    await this.showNotification("Cadence test notification", {
      body: "If you can see this, notifications are working! 🎉",
      tag: "cadence-test",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });
  }
}

// Singleton.
export const notifications = new NotificationManager();

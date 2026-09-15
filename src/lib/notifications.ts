// Browser notification scheduler. Fires alerts at the offsets configured on
// each event (default -30 / -10 / 0 minutes). Polls every 20s while the tab is
// open; the service worker handles persistence across reloads for installed PWAs.

import type { CalendarEvent } from "./types";

const POLL_MS = 20_000;

type AlertCb = (eventId: string, offsetMins: number) => void;

class NotificationManager {
  private events: CalendarEvent[] = [];
  private fired = new Set<string>(); // `${eventId}|${offset}`
  private timer: ReturnType<typeof setInterval> | null = null;
  private onAlert: AlertCb | null = null;

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

    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body, tag: key(ev, offsetMins), icon: "/icon-192.png" });
      }
    } catch {
      // ignore — some browsers require a service worker registration
    }
    this.onAlert?.(ev.id, offsetMins);
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }
}

function key(ev: CalendarEvent, offset: number) {
  return `${ev.id}-${offset}`;
}

// Singleton.
export const notifications = new NotificationManager();

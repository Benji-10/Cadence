// Service worker for Cadence — Intelligent Calendar PWA.
//
// Features:
//   1. App shell precaching + network-first navigation fallback
//   2. Stale-while-revalidate for static assets
//   3. Periodic background sync — fetches upcoming events from the API and
//      fires notifications at the right time, even when the PWA is closed
//      (requires the PWA to be installed + periodic sync permission)
//   4. Message-based alert scheduling from the page (for when the tab is open)
//   5. Notification click → focus/open the app

const VERSION = "cal-v3";
const SHELL = ["/", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];
const API_BASE = self.location.origin;
const POLL_INTERVAL_MIN = 15; // minutes between background sync checks

// ─── Install: precache app shell ───────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches, claim clients ─────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

// ─── Fetch: caching strategies ────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API requests
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network-first, cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ─── Periodic Background Sync ──────────────────────────────────────────────
// Fires every ~15 min (browser-controlled) when the PWA is installed.
// Fetches events from the API and checks if any alerts should fire.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-alerts") {
    event.waitUntil(checkAlerts());
  }
});

// ─── Regular sync (fallback for browsers without periodicSync) ─────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "check-alerts") {
    event.waitUntil(checkAlerts());
  }
});

// Fetch events for the next 2 hours and fire any due alerts.
async function checkAlerts() {
  try {
    const now = Date.now();
    // Look ahead 24h so alerts that are coming up soon are caught by periodic sync.
    const from = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago
    const to = new Date(now + 24 * 60 * 60 * 1000).toISOString(); // 24h ahead

    const res = await fetch(`${API_BASE}/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) return;

    const data = await res.json();
    const events = data.events || [];

    // Track which alerts we've already fired in this SW session.
    if (!self._firedAlerts) self._firedAlerts = new Set();

    for (const ev of events) {
      const startMs = new Date(ev.start).getTime();
      // alerts may be a JSON string or an array — normalize.
      let alerts = ev.alerts;
      if (typeof alerts === "string") {
        try { alerts = JSON.parse(alerts); } catch { alerts = []; }
      }
      if (!Array.isArray(alerts)) alerts = [];

      for (const offset of alerts) {
        const fireAt = startMs + offset * 60 * 1000;
        const key = `${ev.id}|${offset}|${fireAt}`;

        // Fire if the alert time has passed (within last 5 min for periodic sync)
        if (fireAt <= now && now - fireAt < 5 * 60 * 1000 && !self._firedAlerts.has(key)) {
          self._firedAlerts.add(key);

          const when = offset === 0 ? "starts now" : `starts in ${Math.abs(offset)} min`;
          const title = `${ev.title} ${when}`;
          const body = [
            ev.location ? `📍 ${ev.location}` : null,
            offset === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offset)} minutes.`,
          ]
            .filter(Boolean)
            .join(" · ");

          await self.registration.showNotification(title, {
            body,
            tag: key,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: { id: ev.id, url: "/" },
            requireInteraction: false,
          });
        }
      }
    }

    // Clean up old fired alerts (keep only last 2 hours)
    const cutoff = now - 2 * 60 * 60 * 1000;
    for (const key of Array.from(self._firedAlerts)) {
      const ts = Number(key.split("|")[2] || 0);
      if (ts < cutoff) self._firedAlerts.delete(key);
    }
  } catch (e) {
    // Network error — SW is offline, skip this cycle
  }
}

// ─── Message-based alert scheduling (from the page) ─────────────────────────
const scheduledTimers = new Map();

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SCHEDULE_ALERT") {
    const { id, title, body, fireAt, tag } = data;
    const delay = fireAt - Date.now();
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      const t = setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          tag,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { id, url: "/" },
        });
        scheduledTimers.delete(tag);
      }, delay);
      scheduledTimers.set(tag, t);
    }
  } else if (data.type === "CANCEL_ALERT") {
    const t = scheduledTimers.get(data.tag);
    if (t) {
      clearTimeout(t);
      scheduledTimers.delete(data.tag);
    }
  } else if (data.type === "REGISTER_PERIODIC_SYNC") {
    // The page asks us to register periodic sync.
    self.registration.periodicSync
      .register("check-alerts", {
        minInterval: POLL_INTERVAL_MIN * 60 * 1000,
      })
      .catch(() => {
        // periodicSync not supported — fall back to regular sync
        return self.registration.sync.register("check-alerts").catch(() => {});
      });
  }
});

// ─── Notification click: focus or open the app ─────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});

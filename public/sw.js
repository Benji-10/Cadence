// Service worker for the calendar PWA.
// - Precaches the app shell on install.
// - Serves a network-first, cache-fallback strategy for navigations.
// - Caches static assets with a stale-while-revalidate strategy.
// - Listens for "SCHEDULE_ALERT" messages from the page and schedules a
//   Notification.showNotification at the right time so alerts fire even when
//   the tab is backgrounded (as long as the SW stays alive).

const VERSION = "cal-v1";
const SHELL = ["/", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache API requests — they must always be live.
  if (url.pathname.startsWith("/api/")) return;

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

// Alert scheduling from the page.
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
          data: { id },
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
  }
});

// ─── Push event (VAPID web push from server) ────────────────────────────────
// Fires when the server sends a push message via the web-push library.
// This works even when the PWA is completely closed (iOS Safari 16.4+).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = JSON.parse(event.data ? event.data.text() : "{}");
  } catch {
    data = { title: "Cadence", body: event.data ? event.data.text() : "You have an alert" };
  }
  const title = data.title || "Cadence";
  const options = {
    body: data.body || "",
    tag: data.tag || "cadence-alert",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: data.data || { url: "/" },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

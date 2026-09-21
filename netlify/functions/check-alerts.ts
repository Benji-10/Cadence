import { PrismaClient } from "@prisma/client";
import webPush from "web-push";

const db = new PrismaClient();

// This Netlify Scheduled Function runs every 15 minutes.
// It checks for events with alerts that should fire in the next 15 minutes
// and sends web push notifications to all subscribed browsers.
//
// To enable: set the following in netlify.toml or Netlify dashboard:
//   [functions."check-alerts"]
//     schedule = "*/15 * * * *"
//
// Required env vars:
//   DATABASE_URL             — Neon pooled connection string
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — VAPID public key
//   VAPID_PRIVATE_KEY        — VAPID private key

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const ALERT_WINDOW_MIN = 15; // check alerts due within next 15 min

interface ScheduledEvent {
  id: string;
  title: string;
  location: string | null;
  start: Date;
  end: Date;
  alerts: string; // JSON string of number[]
}

export const handler = async (event: { httpMethod?: string } = {}) => {
  // Allow manual triggering via HTTP for testing
  if (event.httpMethod === "GET" || !event.httpMethod) {
    return runCheck();
  }
  return { statusCode: 200, body: "OK" };
};

async function runCheck() {
  console.log("🔄 Checking for due alerts...");

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ VAPID keys not configured");
    return { statusCode: 500, body: "VAPID keys not configured" };
  }

  // Configure web-push
  webPush.setVapidDetails(
    "mailto:notifications@cadence.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const now = Date.now();
  const from = new Date(now);
  const to = new Date(now + ALERT_WINDOW_MIN * 60 * 1000);

  // Fetch events that start within the alert window.
  const events = await db.event.findMany({
    where: {
      start: { gte: from, lte: to },
    },
  });

  console.log(`📅 Found ${events.length} events in the next ${ALERT_WINDOW_MIN} min`);

  // Get all push subscriptions.
  const subs = await db.pushSubscription.findMany();
  console.log(`📱 Found ${subs.length} push subscriptions`);

  if (subs.length === 0 || events.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ events: events.length, subs: subs.length, sent: 0 }) };
  }

  let sent = 0;
  let failed = 0;

  for (const ev of events) {
    // Parse alerts (stored as JSON string like "[-30,-10,0]")
    let alerts: number[] = [];
    try {
      alerts = JSON.parse(ev.alerts || "[]");
    } catch {
      alerts = [];
    }

    const startMs = new Date(ev.start).getTime();

    for (const offset of alerts) {
      const fireAt = startMs + offset * 60 * 1000;
      const tag = `${ev.id}-${offset}`;

      // Check if this alert should fire now (within the alert window)
      // and hasn't already been sent (we approximate with a 5-min dedup window).
      const timeUntilFire = fireAt - now;

      // Fire if:
      // - alert time is in the past (within last 5 min) or within next 15 min
      // - offset is 0 (at start) → fire when event starts
      // - offset is negative (e.g. -30) → fire 30 min before start
      const shouldFire =
        (fireAt <= now && now - fireAt < 5 * 60 * 1000) ||
        (fireAt > now && timeUntilFire <= ALERT_WINDOW_MIN * 60 * 1000);

      if (!shouldFire) continue;

      const when = offset === 0 ? "starts now" : `starts in ${Math.abs(offset)} min`;
      const title = `${ev.title} ${when}`;
      const body = [
        ev.location ? `📍 ${ev.location}` : null,
        offset === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offset)} minutes.`,
      ]
        .filter(Boolean)
        .join(" · ");

      const payload = JSON.stringify({
        title,
        body,
        tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: "/", eventId: ev.id },
      });

      // Send to all subscriptions
      for (const sub of subs) {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
        } catch (e: any) {
          // 410/404 = subscription expired, delete it
          if (e.statusCode === 410 || e.statusCode === 404) {
            await db.pushSubscription
              .delete({ where: { endpoint: sub.endpoint } })
              .catch(() => {});
          }
          failed++;
        }
      }
    }
  }

  console.log(`✅ Sent ${sent} push notifications (${failed} failed)`);
  await db.$disconnect();

  return {
    statusCode: 200,
    body: JSON.stringify({ events: events.length, subs: subs.length, sent, failed }),
  };
}

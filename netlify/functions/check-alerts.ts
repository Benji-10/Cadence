import { PrismaClient } from "@prisma/client";
import webPush from "web-push";

const db = new PrismaClient();

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const ALERT_WINDOW_MIN = 15;

export const handler = async (event: { httpMethod?: string } = {}) => {
  return runCheck();
};

async function runCheck() {
  console.log("🔄 Checking for due alerts...");

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ VAPID keys not configured");
    return { statusCode: 500, body: "VAPID keys not configured" };
  }

  webPush.setVapidDetails(
    "mailto:notifications@cadence.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const now = Date.now();
  const from = new Date(now);
  const to = new Date(now + ALERT_WINDOW_MIN * 60 * 1000);

  const events = await db.event.findMany({
    where: { start: { gte: from, lte: to } },
  });

  console.log(`📅 Found ${events.length} events in the next ${ALERT_WINDOW_MIN} min`);

  const subs = await db.pushSubscription.findMany();
  console.log(`📱 Found ${subs.length} push subscriptions`);

  if (subs.length === 0 || events.length === 0) {
    await db.$disconnect();
    return { statusCode: 200, body: JSON.stringify({ events: events.length, subs: subs.length, sent: 0 }) };
  }

  let sent = 0;
  let failed = 0;

  for (const ev of events) {
    let alerts: number[] = [];
    try { alerts = JSON.parse(ev.alerts || "[]"); } catch { alerts = []; }

    const startMs = new Date(ev.start).getTime();

    for (const offset of alerts) {
      const fireAt = startMs + offset * 60 * 1000;
      const tag = `${ev.id}-${offset}`;
      const timeUntilFire = fireAt - now;

      const shouldFire =
        (fireAt <= now && now - fireAt < 5 * 60 * 1000) ||
        (fireAt > now && timeUntilFire <= ALERT_WINDOW_MIN * 60 * 1000);

      if (!shouldFire) continue;

      const when = offset === 0 ? "starts now" : `starts in ${Math.abs(offset)} min`;
      const title = `${ev.title} ${when}`;
      const body = [
        ev.location ? `📍 ${ev.location}` : null,
        offset === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offset)} minutes.`,
      ].filter(Boolean).join(" · ");

      const payload = JSON.stringify({
        title, body, tag,
        icon: "/icon-192.png", badge: "/icon-192.png",
        data: { url: "/", eventId: ev.id },
      });

      for (const sub of subs) {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
          }
          failed++;
        }
      }
    }
  }

  console.log(`✅ Sent ${sent} push notifications (${failed} failed)`);
  await db.$disconnect();
  return { statusCode: 200, body: JSON.stringify({ events: events.length, subs: subs.length, sent, failed }) };
}

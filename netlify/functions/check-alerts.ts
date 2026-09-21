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
  const startTime = Date.now();
  console.log("🔄 ===== Alert check started =====");
  console.log(`🕒 Time: ${new Date().toISOString()}`);
  console.log(`🔍 VAPID public key configured: ${!!VAPID_PUBLIC_KEY}`);
  console.log(`🔍 VAPID private key configured: ${!!VAPID_PRIVATE_KEY}`);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("❌ VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Netlify env vars");
    return { statusCode: 500, body: JSON.stringify({ error: "VAPID keys not configured" }) };
  }

  webPush.setVapidDetails(
    "mailto:notifications@cadence.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log("✅ VAPID configured");

  const now = Date.now();
  const from = new Date(now);
  const to = new Date(now + ALERT_WINDOW_MIN * 60 * 1000);
  console.log(`📅 Querying events from ${from.toISOString()} to ${to.toISOString()}`);

  // Fetch events starting within the alert window.
  const events = await db.event.findMany({
    where: { start: { gte: from, lte: to } },
  });

  console.log(`📅 Found ${events.length} events in the next ${ALERT_WINDOW_MIN} min`);
  if (events.length > 0) {
    for (const ev of events) {
      let alerts: number[] = [];
      try { alerts = JSON.parse(ev.alerts || "[]"); } catch { alerts = []; }
      console.log(`   • "${ev.title}" at ${new Date(ev.start).toISOString()} — alerts: [${alerts.join(", ")}] — location: ${ev.location || "none"}`);
    }
  }

  // Get all push subscriptions.
  const subs = await db.pushSubscription.findMany();
  console.log(`📱 Found ${subs.length} push subscriptions`);
  if (subs.length > 0) {
    for (const sub of subs) {
      const endpointHost = new URL(sub.endpoint).hostname;
      console.log(`   • ${endpointHost} (endpoint: ${sub.endpoint.substring(0, 60)}...)`);
    }
  }

  if (subs.length === 0) {
    console.log("⚠️ No push subscriptions — users need to open the PWA and enable notifications to subscribe");
    await db.$disconnect();
    return { statusCode: 200, body: JSON.stringify({ events: events.length, subs: 0, sent: 0 }) };
  }

  if (events.length === 0) {
    console.log("ℹ️ No events with alerts in the time window");
    await db.$disconnect();
    return { statusCode: 200, body: JSON.stringify({ events: 0, subs: subs.length, sent: 0 }) };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const ev of events) {
    let alerts: number[] = [];
    try { alerts = JSON.parse(ev.alerts || "[]"); } catch { alerts = []; }

    if (alerts.length === 0) {
      console.log(`⏭️ "${ev.title}" has no alerts configured — skipping`);
      continue;
    }

    const startMs = new Date(ev.start).getTime();

    for (const offset of alerts) {
      const fireAt = startMs + offset * 60 * 1000;
      const tag = `${ev.id}-${offset}`;
      const timeUntilFire = fireAt - now;

      const shouldFire =
        (fireAt <= now && now - fireAt < 5 * 60 * 1000) ||
        (fireAt > now && timeUntilFire <= ALERT_WINDOW_MIN * 60 * 1000);

      if (!shouldFire) {
        skipped++;
        console.log(`⏭️ Alert ${tag} not due yet (fireAt: ${new Date(fireAt).toISOString()}, ${Math.round(timeUntilFire / 1000)}s until fire)`);
        continue;
      }

      const when = offset === 0 ? "starts now" : `starts in ${Math.abs(offset)} min`;
      const title = `${ev.title} ${when}`;
      const body = [
        ev.location ? `📍 ${ev.location}` : null,
        offset === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offset)} minutes.`,
      ].filter(Boolean).join(" · ");

      console.log(`🔔 Firing alert: "${title}" (tag: ${tag})`);
      console.log(`   📨 Body: ${body}`);

      const payload = JSON.stringify({
        title, body, tag,
        icon: "/icon-192.png", badge: "/icon-192.png",
        data: { url: "/", eventId: ev.id },
      });

      for (const sub of subs) {
        const endpointHost = new URL(sub.endpoint).hostname;
        try {
          const result = await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          console.log(`   ✅ Sent to ${endpointHost} (status: ${result.statusCode})`);
          sent++;
        } catch (e: any) {
          console.error(`   ❌ Failed to send to ${endpointHost}: ${e.statusCode} ${e.message || e.body || "unknown error"}`);
          if (e.statusCode === 410 || e.statusCode === 404) {
            console.log(`   🗑️ Deleting expired subscription: ${endpointHost}`);
            await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
          }
          failed++;
        }
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`✅ ===== Alert check complete =====`);
  console.log(`   Sent: ${sent} | Failed: ${failed} | Skipped: ${skipped} | Time: ${elapsed}ms`);

  await db.$disconnect();
  return {
    statusCode: 200,
    body: JSON.stringify({
      events: events.length,
      subs: subs.length,
      sent, failed, skipped,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    }),
  };
}

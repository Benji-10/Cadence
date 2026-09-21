import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/push/send
// Sends a web push notification to ALL stored subscriptions.
// Can be called manually for testing or by the scheduled function.
export async function POST(req: NextRequest) {
  const payload = (await req.json()) as { title: string; body: string; tag: string };

  console.log(`[push/send] Received push request — title: "${payload.title}", tag: "${payload.tag}"`);

  if (!payload.title) {
    console.error(`[push/send] ❌ Missing title`);
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  console.log(`[push/send] VAPID public key configured: ${!!vapidPublicKey}`);
  console.log(`[push/send] VAPID private key configured: ${!!vapidPrivateKey}`);

  if (!vapidPrivateKey || !vapidPublicKey) {
    console.error(`[push/send] ❌ VAPID keys not configured`);
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const subs = await db.pushSubscription.findMany();
  console.log(`[push/send] Found ${subs.length} push subscriptions`);

  if (subs.length === 0) {
    console.log(`[push/send] ⚠️ No subscriptions — users need to open the PWA and enable notifications`);
    return NextResponse.json({ ok: true, sent: 0, message: "No subscriptions" });
  }

  // Log each subscription's push service
  for (const sub of subs) {
    try {
      const host = new URL(sub.endpoint).hostname;
      console.log(`[push/send]   • Subscription: ${host}`);
    } catch {
      console.log(`[push/send]   • Subscription: (invalid endpoint)`);
    }
  }

  let sent = 0;
  let failed = 0;

  try {
    const webPush = await import("web-push");
    webPush.setVapidDetails("mailto:notifications@cadence.app", vapidPublicKey, vapidPrivateKey);
    console.log(`[push/send] ✅ web-push configured with VAPID`);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/" },
    });

    for (const sub of subs) {
      const host = (() => { try { return new URL(sub.endpoint).hostname; } catch { return "unknown"; } })();
      try {
        const result = await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        );
        console.log(`[push/send]   ✅ Sent to ${host} (status: ${result.statusCode})`);
        sent++;
      } catch (e: any) {
        console.error(`[push/send]   ❌ Failed to ${host}: ${e.statusCode} — ${e.message || e.body || "unknown"}`);
        if (e.statusCode === 410 || e.statusCode === 404) {
          console.log(`[push/send]   🗑️ Deleting expired subscription: ${host}`);
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
        failed++;
      }
    }
  } catch (e) {
    console.error(`[push/send] ❌ web-push error:`, String(e));
    return NextResponse.json({ error: "web-push not installed. Run: bun add web-push", detail: String(e) }, { status: 500 });
  }

  console.log(`[push/send] ===== Complete: sent=${sent}, failed=${failed} =====`);
  return NextResponse.json({ ok: true, sent, failed });
}

// GET /api/push/send?title=Test&body=Hello — manual trigger for testing
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title") || "Cadence test";
  const body = req.nextUrl.searchParams.get("body") || "This is a test push notification";
  const tag = req.nextUrl.searchParams.get("tag") || "cadence-test-" + Date.now();

  console.log(`[push/send] GET manual trigger — title: "${title}"`);

  // Reuse the POST logic by calling the same code path
  const mockReq = {
    json: async () => ({ title, body, tag }),
  } as unknown as NextRequest;

  return POST(mockReq);
}

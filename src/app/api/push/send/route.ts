import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AlertPayload } from "@/lib/web-push";

// POST /api/push/send
// Sends a web push notification to ALL stored subscriptions.
// Called by the cron job when an alert should fire.
//
// Requires the `web-push` npm package and VAPID keys:
//   VAPID_PUBLIC_KEY  — env var (NEXT_PUBLIC_ for client access)
//   VAPID_PRIVATE_KEY — env var (server-only)
//
// To install: bun add web-push
// To generate keys: npx web-push generate-vapid-keys

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as AlertPayload;
  const { title, body, tag } = payload;

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPrivateKey || !vapidPublicKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  // Get all push subscriptions.
  const subs = await db.pushSubscription.findMany();

  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No subscriptions" });
  }

  // Dynamically import web-push (avoids build errors if not installed).
  let sent = 0;
  let failed = 0;

  try {
    const webPush = await import("web-push");

    webPush.setVapidDetails(
      "mailto:notifications@cadence.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    const notificationPayload = JSON.stringify({
      title,
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/" },
    });

    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        );
        sent++;
      } catch (e: any) {
        // 410 = subscription expired, delete it
        if (e.statusCode === 410 || e.statusCode === 404) {
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
        failed++;
      }
    }
  } catch (e) {
    // web-push not installed — return helpful error
    return NextResponse.json({
      error: "web-push package not installed. Run: bun add web-push",
      detail: String(e),
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent, failed });
}

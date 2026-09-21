import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as { title: string; body: string; tag: string };

  if (!payload.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPrivateKey || !vapidPublicKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const subs = await db.pushSubscription.findMany();

  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No subscriptions" });
  }

  let sent = 0;
  let failed = 0;

  try {
    const webPush = await import("web-push");
    webPush.setVapidDetails("mailto:notifications@cadence.app", vapidPublicKey, vapidPrivateKey);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/" },
    });

    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        );
        sent++;
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
        failed++;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: "web-push not installed. Run: bun add web-push" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent, failed });
}

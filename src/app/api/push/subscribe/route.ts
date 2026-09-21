import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/push/subscribe
// Stores a web push subscription (endpoint + keys) so the server can send
// push notifications to this browser even when the PWA is closed.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { endpoint, keys } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  // Store in the PushSubscription table (create if not exists).
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}

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

  console.log(`[push/subscribe] Received subscription request`);
  console.log(`[push/subscribe] Endpoint: ${endpoint?.substring(0, 80)}...`);
  console.log(`[push/subscribe] Has p256dh: ${!!keys?.p256dh}, Has auth: ${!!keys?.auth}`);

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    console.error(`[push/subscribe] ❌ Missing fields — endpoint: ${!!endpoint}, p256dh: ${!!keys?.p256dh}, auth: ${!!keys?.auth}`);
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 });
  }

  try {
    // Try to parse the endpoint URL for logging
    const endpointUrl = new URL(endpoint);
    console.log(`[push/subscribe] Push service: ${endpointUrl.hostname}`);
  } catch {
    console.log(`[push/subscribe] Could not parse endpoint URL`);
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });

  const count = await db.pushSubscription.count();
  console.log(`[push/subscribe] ✅ Stored subscription. Total subscriptions: ${count}`);

  return NextResponse.json({ ok: true, totalSubscriptions: count });
}

// GET /api/push/subscribe — returns the count of subscriptions (for debugging)
export async function GET() {
  const count = await db.pushSubscription.count();
  console.log(`[push/subscribe] GET — total subscriptions: ${count}`);
  return NextResponse.json({ totalSubscriptions: count });
}

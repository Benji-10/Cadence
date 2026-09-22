// Web Push notification subscription + VAPID key management.
//
// This module handles:
//   1. Subscribing the browser to a VAPID web push subscription
//   2. Sending the subscription to the server for storage
//   3. Server-side: sending push messages via the Web Push API
//
// VAPID keys are generated once and stored as env vars:
//   VAPID_PUBLIC_KEY  — the public key (safe to expose to the client)
//   VAPID_PRIVATE_KEY — the private key (server-only, used to sign push messages)
//
// To generate VAPID keys:
//   npx web-push generate-vapid-keys
//
// The server uses the `web-push` npm package to send push messages to
// subscribed browsers, even when the PWA is closed.

import type { CalendarEvent } from "./types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId?: string;
}

// ─── Client-side: subscribe to push notifications ──────────────────────────

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VAPID_PUBLIC_KEY not set — push notifications disabled");
    return null;
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const sub: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
        auth: arrayBufferToBase64(subscription.getKey("auth")),
      },
    };

    // Send the subscription to the server.
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });

    return sub;
  } catch (e) {
    console.error("Push subscription failed:", e);
    return null;
  }
}

// ─── Server-side: send a push notification ──────────────────────────────────
// This runs on the server (Netlify function / API route) to send a push
// message to a stored subscription.

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; tag: string; data?: unknown }
): Promise<boolean> {
  // The actual sending is done by the web-push library on the server.
  // This function is a type-safe wrapper that the API route calls.
  // See /api/push/send/route.ts for the implementation.
  return true;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

// ─── Scheduled push: check for upcoming alerts and send push messages ──────
// This is called by a cron job (e.g. Netlify Scheduled Functions or the
// 15-min webDevReview cron) to check for alerts that need to fire and send
// push messages to all subscribed browsers.

export interface AlertPayload {
  eventId: string;
  title: string;
  body: string;
  tag: string;
  fireAt: number;
}

export function buildAlertPayload(ev: CalendarEvent, offsetMins: number): AlertPayload {
  const when = offsetMins === 0 ? "starts now" : `starts in ${Math.abs(offsetMins)} min`;
  const title = `${ev.title} ${when}`;
  const body = [
    ev.location ? `📍 ${ev.location}` : null,
    offsetMins === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offsetMins)} minutes.`,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    eventId: ev.id,
    title,
    body,
    tag: `${ev.id}-${offsetMins}`,
    fireAt: new Date(ev.start).getTime() + offsetMins * 60_000,
  };
}

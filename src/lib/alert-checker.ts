// Shared alert-check logic used by BOTH:
//   • the Netlify scheduled function (netlify/functions/check-alerts.ts)
//   • the local debug route (src/app/api/debug/check-alerts/route.ts)
//
// Keeping the logic in one place means local testing exercises the exact
// same code path as production.
//
// ── The problem this solves ──────────────────────────────────────────
// The Netlify cron fires every 15 minutes but the invocation time JITTERS
// (14:30:49, 14:31:06, …). The old code queried `start >= now`, so an event
// that started 66 seconds before the cron fired was EXCLUDED from the query
// and its "at start" alert never sent.
//
// ── The fix ──────────────────────────────────────────────────────────
//   1. Widen the query window: `start ∈ [now − 20m, now + 45m]`.
//      The look-back catches events that just started despite jitter.
//   2. Dedup via a SentAlert table keyed on (eventId, offset, fireAt).
//      The look-back overlaps across runs; dedup prevents double-firing.
//   3. At-start alerts fire only when `start ≤ now + 2m` (never 15m early).
//      Before-alerts may fire up to 16m early (better early than after).
//
// No increase in cron frequency is needed — the look-back absorbs the jitter.
//
// ── Logging ──────────────────────────────────────────────────────────
// Every step is logged with console.log/error so the Netlify function logs
// show exactly what happened: which events were queried, which alerts were
// due, how many subscriptions exist, and the FULL error details (statusCode,
// body, headers) for any push send that failed. This is essential for
// diagnosing push delivery issues on mobile.

import { PrismaClient, type Event, type PushSubscription } from "@prisma/client";

export const ALERT_TIMING = {
  LOOK_BACK_MIN: 20,
  LOOK_AHEAD_MIN: 45,
  AT_START_LEAD_MIN: 2,
  BEFORE_LEAD_MIN: 16,
  STALE_CUTOFF_MIN: 25,
  SENT_TTL_DAYS: 7,
} as const;

export interface DueAlert {
  eventId: string;
  offset: number;
  fireAt: Date;
  title: string;
  body: string;
  ev: Pick<Event, "id" | "title" | "location" | "start">;
}

export interface AlertCheckResult {
  eventsQueried: number;
  subs: number;
  pending: number;
  sent: number;
  failed: number;
  skippedDup: number;
  pruned: number;
  elapsedMs: number;
  timestamp: string;
  /** Only populated when `dryRun` is true — the alerts that would fire. */
  dueAlerts?: DueAlert[];
}

interface RunOptions {
  db: PrismaClient;
  /** When true, skip the actual web-push send + SentAlert write. Used by
   *  the debug route to preview what would fire without side effects. */
  dryRun?: boolean;
  /** Injected so tests / debug can override "now". Defaults to Date.now(). */
  nowMs?: number;
}

/**
 * Decide whether a single alert should fire on this run.
 *
 * Exported so it can be unit-tested in isolation.
 */
export function shouldFireAlert(offset: number, fireAtMs: number, nowMs: number): boolean {
  if (offset === 0) {
    // At-start: fire once the event has started (or is within 2m of starting).
    // Never fire more than AT_START_LEAD_MIN early.
    return fireAtMs <= nowMs + ALERT_TIMING.AT_START_LEAD_MIN * 60_000
        && nowMs - fireAtMs < ALERT_TIMING.STALE_CUTOFF_MIN * 60_000;
  }
  // Before-alert: fire if within BEFORE_LEAD_MIN of now (slightly early is
  // fine for a heads-up), or already passed (up to STALE_CUTOFF_MIN late).
  return fireAtMs <= nowMs + ALERT_TIMING.BEFORE_LEAD_MIN * 60_000
      && fireAtMs >= nowMs - ALERT_TIMING.STALE_CUTOFF_MIN * 60_000;
}

function safeHost(endpoint: string): string {
  try { return new URL(endpoint).hostname; } catch { return "unknown"; }
}

export async function runAlertCheck(opts: RunOptions): Promise<AlertCheckResult> {
  const { db, dryRun = false } = opts;
  const now = opts.nowMs ?? Date.now();
  const startTime = Date.now();

  console.log("🔄 ===== Alert check started =====");
  console.log(`🕒 Time: ${new Date(now).toISOString()}${dryRun ? " (DRY RUN)" : ""}`);

  // --- Prune old SentAlert rows -----------------------------------------
  let pruned = 0;
  if (!dryRun) {
    const ttlCutoff = new Date(now - ALERT_TIMING.SENT_TTL_DAYS * 24 * 60 * 60 * 1000);
    try {
      const res = await db.sentAlert.deleteMany({ where: { sentAt: { lt: ttlCutoff } } });
      pruned = res.count;
      if (pruned > 0) console.log(`🧹 Pruned ${pruned} SentAlert rows older than ${ALERT_TIMING.SENT_TTL_DAYS} days`);
    } catch (e) {
      console.warn("⚠️ Failed to prune SentAlert (non-fatal):", String(e));
    }
  }

  // --- Query events in the widened window -------------------------------
  const from = new Date(now - ALERT_TIMING.LOOK_BACK_MIN * 60_000);
  const to = new Date(now + ALERT_TIMING.LOOK_AHEAD_MIN * 60_000);
  console.log(`📅 Querying events with start ∈ [${from.toISOString()}, ${to.toISOString()}] (look-back ${ALERT_TIMING.LOOK_BACK_MIN}m, look-ahead ${ALERT_TIMING.LOOK_AHEAD_MIN}m)`);

  const events = await db.event.findMany({
    where: { start: { gte: from, lte: to } },
  });

  console.log(`📅 Found ${events.length} events in the window`);
  if (events.length > 0) {
    for (const ev of events) {
      let alerts: number[] = [];
      try { alerts = JSON.parse(ev.alerts || "[]"); } catch { alerts = []; }
      console.log(`   • "${ev.title}" at ${new Date(ev.start).toISOString()} — alerts: [${alerts.join(", ")}] — location: ${ev.location || "none"}`);
    }
  }

  // --- Collect pending alerts -------------------------------------------
  const pending: DueAlert[] = [];
  for (const ev of events) {
    let alerts: number[] = [];
    try { alerts = JSON.parse(ev.alerts || "[]"); } catch { alerts = []; }
    if (alerts.length === 0) {
      console.log(`⏭️ "${ev.title}" has no alerts configured — skipping`);
      continue;
    }

    const startMs = new Date(ev.start).getTime();
    for (const offset of alerts) {
      const fireAtMs = startMs + offset * 60_000;
      const fireAt = new Date(fireAtMs);
      const delta = Math.round((fireAtMs - now) / 1000);

      if (!shouldFireAlert(offset, fireAtMs, now)) {
        console.log(`⏭️ Alert ${ev.id}/${offset} not due (fireAt ${fireAt.toISOString()}, Δ${delta}s)`);
        continue;
      }
      console.log(`🔔 Alert DUE: "${ev.title}" offset=${offset} fireAt=${fireAt.toISOString()} (Δ${delta}s)`);
      pending.push({
        eventId: ev.id,
        offset,
        fireAt,
        title: `${ev.title} ${offset === 0 ? "starts now" : `starts in ${Math.abs(offset)} min`}`,
        body: [
          ev.location ? `📍 ${ev.location}` : null,
          offset === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offset)} minutes.`,
        ].filter(Boolean).join(" · "),
        ev: { id: ev.id, title: ev.title, location: ev.location, start: ev.start },
      });
    }
  }

  console.log(`🔔 ${pending.length} alert(s) are due this run`);

  // --- Dry run? Return the preview without side effects ----------------
  if (dryRun) {
    console.log(`ℹ️ Dry run — skipping push send + SentAlert write`);
    await db.$disconnect();
    return {
      eventsQueried: events.length,
      subs: 0,
      pending: pending.length,
      sent: 0,
      failed: 0,
      skippedDup: 0,
      pruned,
      elapsedMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      dueAlerts: pending,
    };
  }

  // --- Fetch push subscriptions -----------------------------------------
  const subs: PushSubscription[] = await db.pushSubscription.findMany();
  console.log(`📱 Found ${subs.length} push subscriptions`);
  if (subs.length > 0) {
    for (const sub of subs) {
      const host = safeHost(sub.endpoint);
      console.log(`   • ${host} (endpoint: ${sub.endpoint.substring(0, 60)}...)`);
      console.log(`     p256dh: ${sub.p256dh ? sub.p256dh.substring(0, 20) + "..." : "(missing)"} (len=${sub.p256dh?.length || 0})`);
      console.log(`     auth:   ${sub.auth ? sub.auth.substring(0, 20) + "..." : "(missing)"} (len=${sub.auth?.length || 0})`);
    }
  }

  if (subs.length === 0) {
    console.log("⚠️ No push subscriptions — users need to open the PWA and enable notifications to subscribe");
  }
  if (pending.length === 0) {
    console.log("ℹ️ No alerts due");
  }
  if (subs.length === 0 || pending.length === 0) {
    const elapsedMs = Date.now() - startTime;
    console.log(`✅ ===== Alert check complete (nothing to send) — ${elapsedMs}ms =====`);
    await db.$disconnect();
    return {
      eventsQueried: events.length,
      subs: subs.length,
      pending: pending.length,
      sent: 0,
      failed: 0,
      skippedDup: 0,
      pruned,
      elapsedMs,
      timestamp: new Date().toISOString(),
    };
  }

  // --- Dedup: which pending keys already sent? -------------------------
  const alreadySent = new Set<string>();
  if (pending.length > 0) {
    const existing = await db.sentAlert.findMany({
      where: {
        OR: pending.map((p) => ({
          eventId: p.eventId,
          offset: p.offset,
          fireAt: p.fireAt,
        })),
      },
      select: { eventId: true, offset: true, fireAt: true },
    });
    for (const r of existing) {
      alreadySent.add(`${r.eventId}|${r.offset}|${r.fireAt.getTime()}`);
    }
    console.log(`📋 ${existing.length} of ${pending.length} due alert(s) already sent (dedup)`);
  }

  // --- Dynamically import web-push (server-only) -----------------------
  // Done lazily so the dry-run path (used by the debug route) doesn't
  // require VAPID keys to be set.
  const webPush = (await import("web-push")).default;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
  console.log(`🔑 VAPID public key configured: ${!!vapidPublic}${vapidPublic ? ` (${vapidPublic.substring(0, 20)}...)` : ""}`);
  console.log(`🔑 VAPID private key configured: ${!!vapidPrivate}`);
  if (vapidPublic && vapidPrivate) {
    webPush.setVapidDetails("mailto:notifications@cadence.app", vapidPublic, vapidPrivate);
    console.log(`✅ web-push configured with VAPID`);
  } else {
    console.error("❌ VAPID keys not configured — push will fail. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env vars.");
  }

  let sent = 0;
  let failed = 0;
  let skippedDup = 0;

  for (const p of pending) {
    const dedupKey = `${p.eventId}|${p.offset}|${p.fireAt.getTime()}`;
    if (alreadySent.has(dedupKey)) {
      skippedDup++;
      console.log(`🔀 Already sent ${dedupKey} — skipping`);
      continue;
    }

    const payload = JSON.stringify({
      title: p.title,
      body: p.body,
      tag: dedupKey,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/", eventId: p.eventId },
    });

    console.log(`🔔 Firing alert: "${p.title}" (key: ${dedupKey})`);
    console.log(`   📨 Body: ${p.body}`);
    console.log(`   📦 Payload: ${payload.substring(0, 200)}${payload.length > 200 ? "..." : ""}`);

    let anySent = false;
    for (const sub of subs) {
      const host = safeHost(sub.endpoint);
      try {
        console.log(`   → Sending to ${host}...`);
        const result = await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        console.log(`   ✅ Sent to ${host} (status: ${result.statusCode})`);
        anySent = true;
      } catch (e: any) {
        // Log the FULL error so we can diagnose push failures.
        // Common failures:
        //   404/410 → subscription expired/unsubscribed → delete it
        //   400     → bad VAPID key or malformed subscription
        //   403     → wrong VAPID subject (mailto:) or key mismatch
        //   429     → rate limited by push service
        //   5xx     → push service internal error
        console.error(`   ❌ Failed to send to ${host}:`);
        console.error(`      statusCode: ${e.statusCode}`);
        console.error(`      message:    ${e.message || "(none)"}`);
        if (e.body) {
          const bodyStr = typeof e.body === "string" ? e.body : JSON.stringify(e.body);
          console.error(`      body:       ${bodyStr.substring(0, 300)}`);
        }
        if (e.headers) {
          console.error(`      headers:    content-type=${e.headers["content-type"] || "?"}, www-authenticate=${e.headers["www-authenticate"] || "(none)"}`);
        }

        if (e.statusCode === 410 || e.statusCode === 404) {
          console.log(`   🗑️ Deleting expired subscription: ${host}`);
          await db.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
        failed++;
      }
    }

    if (anySent) {
      sent++;
      try {
        await db.sentAlert.create({
          data: { eventId: p.eventId, offset: p.offset, fireAt: p.fireAt },
        });
        console.log(`   📝 Recorded SentAlert ${dedupKey}`);
      } catch (e: any) {
        // P2002 = unique constraint violation (concurrent run already recorded)
        if (e?.code !== "P2002") {
          console.warn(`   ⚠️ Couldn't record SentAlert (non-fatal): ${String(e)}`);
        }
      }
    } else {
      console.log(`   ⚠️ No subscriptions received this alert — not recording SentAlert`);
    }
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`✅ ===== Alert check complete =====`);
  console.log(`   Sent: ${sent} | Failed: ${failed} | Skipped (dup): ${skippedDup} | Time: ${elapsedMs}ms`);

  await db.$disconnect();
  return {
    eventsQueried: events.length,
    subs: subs.length,
    pending: pending.length,
    sent,
    failed,
    skippedDup,
    pruned,
    elapsedMs,
    timestamp: new Date().toISOString(),
  };
}

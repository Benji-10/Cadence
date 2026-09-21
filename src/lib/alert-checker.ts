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

export async function runAlertCheck(opts: RunOptions): Promise<AlertCheckResult> {
  const { db, dryRun = false } = opts;
  const now = opts.nowMs ?? Date.now();
  const startTime = Date.now();

  // --- Prune old SentAlert rows -----------------------------------------
  let pruned = 0;
  if (!dryRun) {
    const ttlCutoff = new Date(now - ALERT_TIMING.SENT_TTL_DAYS * 24 * 60 * 60 * 1000);
    try {
      const res = await db.sentAlert.deleteMany({ where: { sentAt: { lt: ttlCutoff } } });
      pruned = res.count;
    } catch {
      // non-fatal
    }
  }

  // --- Query events in the widened window -------------------------------
  const from = new Date(now - ALERT_TIMING.LOOK_BACK_MIN * 60_000);
  const to = new Date(now + ALERT_TIMING.LOOK_AHEAD_MIN * 60_000);

  const events = await db.event.findMany({
    where: { start: { gte: from, lte: to } },
  });

  // --- Collect pending alerts -------------------------------------------
  const pending: DueAlert[] = [];
  for (const ev of events) {
    let alerts: number[] = [];
    try { alerts = JSON.parse(ev.alerts || "[]"); } catch { alerts = []; }
    if (alerts.length === 0) continue;

    const startMs = new Date(ev.start).getTime();
    for (const offset of alerts) {
      const fireAtMs = startMs + offset * 60_000;
      if (!shouldFireAlert(offset, fireAtMs, now)) continue;
      pending.push({
        eventId: ev.id,
        offset,
        fireAt: new Date(fireAtMs),
        title: `${ev.title} ${offset === 0 ? "starts now" : `starts in ${Math.abs(offset)} min`}`,
        body: [
          ev.location ? `📍 ${ev.location}` : null,
          offset === 0 ? "It's starting now." : `Heads up — beginning ${Math.abs(offset)} minutes.`,
        ].filter(Boolean).join(" · "),
        ev: { id: ev.id, title: ev.title, location: ev.location, start: ev.start },
      });
    }
  }

  // --- Dry run? Return the preview without side effects ----------------
  if (dryRun) {
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
  if (subs.length === 0 || pending.length === 0) {
    await db.$disconnect();
    return {
      eventsQueried: events.length,
      subs: subs.length,
      pending: pending.length,
      sent: 0,
      failed: 0,
      skippedDup: 0,
      pruned,
      elapsedMs: Date.now() - startTime,
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
  }

  // --- Dynamically import web-push (server-only) -----------------------
  // Done lazily so the dry-run path (used by the debug route) doesn't
  // require VAPID keys to be set.
  const webPush = (await import("web-push")).default;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";
  if (vapidPublic && vapidPrivate) {
    webPush.setVapidDetails("mailto:notifications@cadence.app", vapidPublic, vapidPrivate);
  }

  let sent = 0;
  let failed = 0;
  let skippedDup = 0;

  for (const p of pending) {
    const dedupKey = `${p.eventId}|${p.offset}|${p.fireAt.getTime()}`;
    if (alreadySent.has(dedupKey)) {
      skippedDup++;
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

    let anySent = false;
    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        anySent = true;
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
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
      } catch (e: any) {
        // P2002 = unique constraint violation (concurrent run already recorded)
        if (e?.code !== "P2002") {
          // non-fatal
        }
      }
    }
  }

  await db.$disconnect();
  return {
    eventsQueried: events.length,
    subs: subs.length,
    pending: pending.length,
    sent,
    failed,
    skippedDup,
    pruned,
    elapsedMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

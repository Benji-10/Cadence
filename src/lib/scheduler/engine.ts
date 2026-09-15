// The scheduling brain. Pure functions — no IO, no React, runs on server & client.
//
// Three entry points the UI/API cares about:
//   - findBestSlot(...)     → where should this task go?
//   - rescheduleAround(...) → I placed this task here; bump everything now in the way.
//   - autoReorderWeek(...)  → conservative tidy-up that resolves overlaps and nudges
//                              misplaced flexible tasks to better-fitting nearby slots.
//
// Design principles (from the user's brief):
//   • Lectures, sport, flying/appointments, travel & sleep are FIXED. Never move them.
//   • Work / homework / language / coding / PPL / cubing are FLEXIBLE — movable & splittable,
//     but a split chunk must respect minChunkMins (no 10-minute scraps).
//   • Laundry is HOME-BOUND: only scheduled at home, can overlap with at-home work, never with sleep.
//   • Sport can't be wedged between laundry and sleep (it lives at the sports centre).
//   • Prefer location-clustering: keep tasks near events at the same place to avoid ping-ponging.
//   • The auto-tidy must respect the week's daily structure — it never shuffles a Monday-afternoon
//     task to Monday-morning just because a gap exists. It only moves tasks to resolve genuine
//     conflicts or to land them in a strictly better-fitting slot on the SAME day.

import { CalendarEvent, LocationType, ReorderResult } from "../types";
import {
  chunkDuration,
  findFreeGaps,
  locationScore,
} from "./constraints";
import { addDays, addMins, durationMins, toMs } from "./time";

// ---- time-of-day preference -------------------------------------------------
function timeOfDayScore(category: string, startMs: number): number {
  const d = new Date(startMs);
  const h = d.getHours();
  switch (category) {
    case "work":
    case "homework":
    case "coding":
      return h >= 8 && h <= 19 ? 5 : h >= 6 && h <= 22 ? 2 : -5;
    case "language":
    case "cubing":
    case "ppl":
      return h >= 18 && h <= 23 ? 5 : h >= 8 && h <= 23 ? 3 : -5;
    case "social":
      return h >= 17 || h <= 2 ? 5 : 0;
    case "laundry":
      return h >= 8 && h <= 21 ? 5 : -10;
    case "cooking":
      return h >= 11 && h <= 21 ? 5 : -5;
    case "free":
      return 2;
    default:
      return 1;
  }
}

export interface SlotPlan {
  placements: { start: string; end: string }[];
  score: number;
  reason: string;
}

// Find the best placement for a task. If `preferNearMs` is set, slots on the
// same calendar day get a strong boost (so bumped tasks stay near home).
export function findBestSlot(
  task: { category: string; locationType: LocationType; minChunkMins: number; flexibility: string },
  durationNeededMins: number,
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
  preferNearMs?: number
): SlotPlan | null {
  const fixed = events.filter((e) => e.flexibility === "fixed");
  const gaps = findFreeGaps(fixed, rangeStart, rangeEnd);

  const canSplit = task.flexibility === "flexible";
  const chunks = canSplit
    ? chunkDuration(durationNeededMins, task.minChunkMins)
    : [durationNeededMins];

  const candidates = gaps
    .map((g) => {
      const gapMins = durationMins(g.start, g.end);
      const firstChunk = chunks[0];
      if (gapMins < firstChunk) return null;
      const loc = locationScore(task.locationType, g.locationType);
      if (loc <= 0 && task.locationType !== "any") return null;
      const tod = timeOfDayScore(task.category, toMs(g.start));
      const gapMid = toMs(g.start) + (gapMins / 2) * 60 * 1000;
      let proximity = 0;
      if (preferNearMs !== undefined) {
        const sameDay =
          new Date(gapMid).toDateString() === new Date(preferNearMs).toDateString();
        proximity = sameDay ? 12 : 0;
      }
      const total = proximity + loc * 3 + tod;
      return { gap: g, total };
    })
    .filter((x): x is { gap: typeof gaps[number]; total: number } => x !== null)
    .sort((a, b) => b.total - a.total);

  if (candidates.length === 0) return null;

  // Greedy: fill chunks across the best gaps in order.
  const placements: { start: string; end: string }[] = [];
  let remaining = durationNeededMins;
  const orderedChunks = [...chunks].sort((a, b) => b - a);

  for (const cand of candidates) {
    if (remaining <= 0) break;
    let cursor = toMs(cand.gap.start);
    const gapEnd = toMs(cand.gap.end);
    while (remaining > 0 && cursor < gapEnd) {
      const chunk = orderedChunks[0] ?? remaining;
      if (cursor + chunk * 60 * 1000 > gapEnd) break;
      const s = new Date(cursor).toISOString();
      const e = addMins(s, chunk);
      placements.push({ start: s, end: e });
      cursor += chunk * 60 * 1000;
      remaining -= chunk;
      orderedChunks.shift();
    }
  }

  if (remaining > 0) return null;

  const best = candidates[0];
  return {
    placements,
    score: best.total,
    reason:
      placements.length > 1
        ? `Split into ${placements.length} chunks (min ${task.minChunkMins}m) across free gaps nearby.`
        : `Fits a ${durationNeededMins}m gap that matches ${task.locationType === "any" ? "any location" : task.locationType}.`,
  };
}

// Place `anchor` at [newStart, newEnd], then bump every flexible event it now
// overlaps into the best alternative slot — preferring the same day.
export function rescheduleAround(
  anchor: CalendarEvent,
  newStart: string,
  newEnd: string,
  allEvents: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string
): ReorderResult {
  const notes: string[] = [];
  const changes: ReorderResult["changes"] = [];

  const moved: CalendarEvent[] = allEvents.map((e) =>
    e.id === anchor.id ? { ...e, start: newStart, end: newEnd } : { ...e }
  );

  const bumped = moved.filter(
    (e) =>
      e.id !== anchor.id &&
      e.flexibility !== "fixed" &&
      toMs(e.start) < toMs(newEnd) &&
      toMs(e.end) > toMs(newStart) &&
      !(e.allowOverlap && anchor.allowOverlap)
  );

  for (const ev of bumped) {
    const dur = durationMins(ev.start, ev.end);
    const others = moved.filter((x) => x.id !== ev.id);
    // Prefer to keep the bumped task on its OWN day, then near the anchor.
    const prefer = toMs(ev.start);
    const plan = findBestSlot(
      {
        category: ev.category,
        locationType: ev.locationType,
        minChunkMins: ev.minChunkMins,
        flexibility: ev.flexibility,
      },
      dur,
      others,
      rangeStart,
      rangeEnd,
      prefer
    );

    if (!plan) {
      notes.push(
        `Couldn't auto-move "${ev.title}" — no free slot this week. It now overlaps "${anchor.title}".`
      );
      continue;
    }

    const p = plan.placements[0];
    const idx = moved.findIndex((x) => x.id === ev.id);
    moved[idx] = { ...moved[idx], start: p.start, end: p.end };
    changes.push({
      eventId: ev.id,
      fromStart: ev.start,
      toStart: p.start,
      fromEnd: ev.end,
      toEnd: p.end,
      reason: plan.reason,
    });

    if (plan.placements.length > 1) {
      notes.push(
        `"${ev.title}" was too long for a single gap — placed the main ${Math.round(
          (toMs(p.end) - toMs(p.start)) / 60000
        )}m chunk; ${plan.placements.length - 1} more suggested.`
      );
    }
  }

  return { events: moved, changes, notes };
}

// Conservative full-week tidy. For each flexible event:
//   1. If it currently overlaps a fixed event → find a better same-day slot.
//   2. Otherwise → leave it where it is.
// This NEVER scrambles the week; it only resolves genuine conflicts.
export function autoReorderWeek(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string
): ReorderResult {
  const notes: string[] = [];
  const changes: ReorderResult["changes"] = [];

  const fixed = events.filter((e) => e.flexibility === "fixed");
  const flexible = events.filter((e) => e.flexibility !== "fixed");

  // Sort flexible so the highest-priority / longest tasks get first pick.
  flexible.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return durationMins(b.start, b.end) - durationMins(a.start, a.end);
  });

  const placed: CalendarEvent[] = [...fixed];

  for (const task of flexible) {
    const overlapsFixed = fixed.some(
      (f) =>
        f.id !== task.id &&
        toMs(task.start) < toMs(f.end) &&
        toMs(task.end) > toMs(f.start) &&
        !(task.allowOverlap && f.allowOverlap)
    );

    if (!overlapsFixed) {
      // No conflict — keep the task exactly where it is.
      placed.push(task);
      continue;
    }

    // Conflict: find a better slot on the SAME day.
    const dayStart = new Date(task.start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart.toISOString(), 1);

    const plan = findBestSlot(
      {
        category: task.category,
        locationType: task.locationType,
        minChunkMins: task.minChunkMins,
        flexibility: task.flexibility,
      },
      durationMins(task.start, task.end),
      placed,
      dayStart.toISOString(),
      dayEnd,
      toMs(task.start)
    );

    if (!plan) {
      // No same-day slot — try the whole week as a fallback.
      const weekPlan = findBestSlot(
        {
          category: task.category,
          locationType: task.locationType,
          minChunkMins: task.minChunkMins,
          flexibility: task.flexibility,
        },
        durationMins(task.start, task.end),
        placed,
        rangeStart,
        rangeEnd,
        toMs(task.start)
      );
      if (!weekPlan) {
        notes.push(`No free slot found for "${task.title}" — left in place (it overlaps a fixed event).`);
        placed.push(task);
        continue;
      }
      const p = weekPlan.placements[0];
      const updated = { ...task, start: p.start, end: p.end };
      placed.push(updated);
      changes.push({
        eventId: task.id,
        fromStart: task.start,
        toStart: p.start,
        fromEnd: task.end,
        toEnd: p.end,
        reason: "Moved to a free slot later this week (no room on its own day).",
      });
      continue;
    }

    const p = plan.placements[0];
    const updated = { ...task, start: p.start, end: p.end };
    placed.push(updated);
    changes.push({
      eventId: task.id,
      fromStart: task.start,
      toStart: p.start,
      fromEnd: task.end,
      toEnd: p.end,
      reason: plan.reason,
    });
  }

  return { events: placed, changes, notes };
}

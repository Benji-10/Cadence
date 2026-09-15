// Constraint validation: can a given event occupy a proposed time window
// without colliding with fixed events or breaking location rules?

import { CalendarEvent, LocationType, ValidationResult } from "../types";
import { addMins, overlapMins, overlaps, toMs } from "./time";

// Infer the location "context" of a point in time from the nearest surrounding
// fixed events. This is how we decide whether a gap is "at home", "on campus"
// or "at the sports centre" without the user labelling every task.
export function inferLocationAt(
  iso: string,
  events: CalendarEvent[]
): LocationType {
  const others = events
    .filter((e) => e.flexibility === "fixed")
    .sort((a, b) => toMs(a.start) - toMs(b.start));

  let context: LocationType = "any";
  for (const e of others) {
    if (toMs(e.start) <= toMs(iso) && toMs(iso) < toMs(e.end)) {
      // inside a fixed event — its location wins
      return e.locationType === "any" ? context : e.locationType;
    }
    if (toMs(e.start) > toMs(iso)) {
      // upcoming fixed event; if a travel block leads into it, the gap before
      // the travel is the *previous* location.
      break;
    }
    if (e.locationType !== "any" && e.locationType !== "travel") {
      context = e.locationType;
    }
  }
  return context;
}

// Score how well a slot matches a task's location preference. Higher = better.
export function locationScore(
  taskLoc: LocationType,
  slotLoc: LocationType
): number {
  if (taskLoc === "any") return 2; // any slot is fine, slight preference for "any"/home
  if (taskLoc === slotLoc) return 10; // perfect match
  // Soft matches:
  //  - a home task can go to "any" (we assume you can be at home)
  //  - an "out"/"sports"/"campus" task in an "any" slot is plausible but not ideal
  if (slotLoc === "any") return 4;
  return 0; // mismatch (e.g. laundry slot at the sports centre)
}

export function validateWindow(
  event: CalendarEvent,
  newStart: string,
  newEnd: string,
  allEvents: CalendarEvent[]
): ValidationResult {
  const conflicts: CalendarEvent[] = [];

  for (const other of allEvents) {
    if (other.id === event.id) continue;

    // Overlap-allowed tasks (e.g. laundry) may share time with work but never
    // with fixed/sleep events.
    const bothAllowOverlap = event.allowOverlap && other.allowOverlap;
    const overlapsFixed = other.flexibility === "fixed";

    if (bothAllowOverlap && !overlapsFixed) {
      // permissible overlap (laundry + work)
      continue;
    }

    if (overlaps(newStart, newEnd, other.start, other.end)) {
      // Sleep is sacred — never schedule anything over sleep.
      if (other.category === "sleep") {
        conflicts.push(other);
        continue;
      }
      if (other.flexibility === "fixed") {
        conflicts.push(other);
        continue;
      }
      // Overlap with another movable/flexible task: flagged but resolvable by
      // the reorder engine. We surface it as a soft conflict.
      const mins = overlapMins(newStart, newEnd, other.start, other.end);
      if (mins >= 5) {
        conflicts.push(other);
      }
    }
  }

  if (conflicts.length > 0) {
    const hardConflicts = conflicts.filter(
      (c) => c.flexibility === "fixed" || c.category === "sleep"
    );
    if (hardConflicts.length > 0) {
      return {
        valid: false,
        reason:
          hardConflicts.length === 1
            ? `Can't place here — overlaps "${hardConflicts[0].title}" (fixed).`
            : `Can't place here — overlaps ${hardConflicts.length} fixed events.`,
        conflicts,
      };
    }
    return {
      valid: true,
      reason: `Will auto-bump ${conflicts.length} flexible task${conflicts.length > 1 ? "s" : ""} elsewhere.`,
      conflicts,
    };
  }

  return { valid: true, conflicts: [] };
}

// Given a task that needs `durationMins`, produce one or more concrete
// placements whose chunks respect `minChunkMins`.
export function chunkDuration(
  durationMins: number,
  minChunkMins: number
): number[] {
  if (durationMins <= minChunkMins) return [durationMins];
  const chunks: number[] = [];
  const min = Math.max(minChunkMins, 15);
  let remaining = durationMins;
  // Try to split into equal-ish chunks each >= minChunk
  const n = Math.max(1, Math.round(durationMins / Math.max(min, durationMins / 4)));
  const base = Math.floor(durationMins / n);
  for (let i = 0; i < n; i++) {
    chunks.push(base);
    remaining -= base;
  }
  // distribute remainder
  let i = 0;
  while (remaining > 0) {
    chunks[i % chunks.length] += 1;
    remaining -= 1;
    i++;
  }
  // drop any chunk below minChunk by merging into the largest neighbour
  const merged = [...chunks];
  for (let k = 0; k < merged.length; k++) {
    if (merged[k] < min) {
      const biggest = merged.indexOf(Math.max(...merged));
      merged[biggest] += merged[k];
      merged.splice(k, 1);
      k--;
    }
  }
  return merged.length ? merged : [durationMins];
}

// Build a list of free gaps between fixed events within [rangeStart, rangeEnd].
export function findFreeGaps(
  fixedEvents: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string
): { start: string; end: string; locationType: LocationType }[] {
  const start = toMs(rangeStart);
  const end = toMs(rangeEnd);

  // Collect non-overlapping fixed intervals clipped to the range.
  type Iv = { s: number; e: number; loc: LocationType };
  const ivs: Iv[] = [];
  for (const fe of fixedEvents) {
    const s = Math.max(start, toMs(fe.start));
    const e = Math.min(end, toMs(fe.end));
    if (e > s) ivs.push({ s, e, loc: fe.locationType });
  }
  ivs.sort((a, b) => a.s - b.s);

  // Merge overlapping intervals (preserving the dominant location).
  const merged: Iv[] = [];
  for (const iv of ivs) {
    const last = merged[merged.length - 1];
    if (last && iv.s <= last.e) {
      last.e = Math.max(last.e, iv.e);
      if (last.loc === "any" && iv.loc !== "any") last.loc = iv.loc;
    } else {
      merged.push({ ...iv });
    }
  }

  // Gaps are the spaces between merged intervals (and before/after).
  const gaps: { start: string; end: string; locationType: LocationType }[] = [];
  let cursor = start;
  let prevLoc: LocationType = "any";
  for (const iv of merged) {
    if (iv.s > cursor) {
      // gap from cursor to iv.s — its location is the location of the event
      // that just ended (prevLoc), because that's where we currently are.
      gaps.push({
        start: addMins(new Date(cursor).toISOString(), 0),
        end: new Date(iv.s).toISOString(),
        locationType: prevLoc === "any" ? "any" : prevLoc,
      });
    }
    cursor = Math.max(cursor, iv.e);
    if (iv.loc !== "any") prevLoc = iv.loc;
  }
  if (cursor < end) {
    gaps.push({
      start: new Date(cursor).toISOString(),
      end: new Date(end).toISOString(),
      locationType: prevLoc === "any" ? "any" : prevLoc,
    });
  }
  return gaps;
}

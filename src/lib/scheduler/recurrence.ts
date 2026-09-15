// Expand recurring events into concrete occurrence instances within a date range.
// A "virtual" occurrence shares the parent event's id+`#occN` suffix so React
// keys stay stable, and inherits all metadata (color, calendar, alerts, etc).
// The parent (original) event is also emitted in its own slot.

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInMinutes,
  parseISO,
} from "date-fns";
import type { CalendarEvent, RecurrenceRule } from "../types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Expand a single recurring event into occurrences whose start falls within
// [rangeStart, rangeEnd). Cap at a sane maximum to avoid runaway loops.
export function expandRecurrence(
  event: CalendarEvent,
  rangeStartMs: number,
  rangeEndMs: number,
  maxOccurrences = 200
): CalendarEvent[] {
  if (!event.recurrence) return [event];

  const rule = event.recurrence as RecurrenceRule;
  const durationMs = parseISO(event.end).getTime() - parseISO(event.start).getTime();
  const origStartMs = parseISO(event.start).getTime();
  const untilMs = rule.until ? parseISO(rule.until).getTime() : Infinity;
  const interval = Math.max(1, rule.interval);

  const occurrences: CalendarEvent[] = [];
  let cursor = origStartMs;
  let n = 0;

  while (cursor < rangeEndMs && n < maxOccurrences) {
    if (cursor > untilMs) break;
    if (cursor + durationMs >= rangeStartMs) {
      // For weekly rules with daysOfWeek, only emit matching days.
      const dayOk =
        !rule.daysOfWeek || rule.daysOfWeek.length === 0
          ? true
          : rule.daysOfWeek.includes(new Date(cursor).getDay());
      if (dayOk && cursor !== origStartMs) {
        occurrences.push(makeOccurrence(event, cursor, durationMs, n));
      } else if (dayOk && cursor === origStartMs) {
        occurrences.push(event); // the parent itself
      }
    }
    cursor = step(cursor, rule, interval);
    n++;
  }

  // If the parent's start is outside the range but an early occurrence is in,
  // ensure we still emit the parent when relevant (rare). The loop above
  // already handles the common case.
  if (occurrences.length === 0) return [event];
  return occurrences;
}

function step(ms: number, rule: RecurrenceRule, interval: number): number {
  switch (rule.freq) {
    case "daily":
      return addDays(new Date(ms), interval).getTime();
    case "weekly":
      return addWeeks(new Date(ms), interval).getTime();
    case "monthly":
      return addMonths(new Date(ms), interval).getTime();
    case "yearly":
      return addYears(new Date(ms), interval).getTime();
    default:
      return ms + MS_PER_DAY;
  }
}

function makeOccurrence(
  parent: CalendarEvent,
  startMs: number,
  durationMs: number,
  idx: number
): CalendarEvent {
  const endMs = startMs + durationMs;
  return {
    ...parent,
    id: `${parent.id}#occ${idx}`,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

// Expand an array of events (mixed recurring + one-off) for a range.
export function expandAllRecurrence(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string
): CalendarEvent[] {
  const s = parseISO(rangeStart).getTime();
  const e = parseISO(rangeEnd).getTime();
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    out.push(...expandRecurrence(ev, s, e));
  }
  return out;
}

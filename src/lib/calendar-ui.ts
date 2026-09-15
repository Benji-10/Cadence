// UI-only helpers for the calendar: hour height, color resolution, lane layout
// (interval partitioning for side-by-side overlap rendering like iOS), and
// date/time formatting via date-fns.

import { format, differenceInMinutes, isSameDay, parseISO } from "date-fns";
import type { Calendar, CalendarEvent } from "./types";

// MUST stay in sync with --cal-hour-h in globals.css.
export const HOUR_HEIGHT = 56;

// Fallback palette for events without a calendar color or override.
const FALLBACK_COLOR = "#64748B"; // slate-500

export function eventColor(
  event: Pick<CalendarEvent, "color" | "calendarId">,
  calendarsById: Record<string, Calendar | undefined>
): string {
  if (event.color) return event.color;
  const cal = calendarsById[event.calendarId];
  return cal?.color ?? FALLBACK_COLOR;
}

// Convert a hex color to an "rgba()" string with the given alpha.
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Pick black or white text for readability on top of the given hex.
export function contrastText(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  // Relative luminance (per W3C).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0b0b0f" : "#ffffff";
}

// ---- Lane layout (interval partitioning) ---------------------------------

export interface PositionedEvent {
  event: CalendarEvent;
  lane: number; // 0..lanesInCluster-1
  lanesInCluster: number;
}

export function layoutEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const sa = parseISO(a.start).getTime();
    const sb = parseISO(b.start).getTime();
    if (sa !== sb) return sa - sb;
    // Longer first so the lane assignment is stable.
    return parseISO(b.end).getTime() - parseISO(a.end).getTime();
  });

  // Group into clusters (transitively-overlapping groups).
  const clusters: CalendarEvent[][] = [];
  let current: CalendarEvent[] = [];
  let clusterEnd = -Infinity;
  for (const ev of sorted) {
    const s = parseISO(ev.start).getTime();
    if (current.length === 0) {
      current = [ev];
      clusterEnd = parseISO(ev.end).getTime();
    } else if (s < clusterEnd) {
      current.push(ev);
      clusterEnd = Math.max(clusterEnd, parseISO(ev.end).getTime());
    } else {
      clusters.push(current);
      current = [ev];
      clusterEnd = parseISO(ev.end).getTime();
    }
  }
  if (current.length > 0) clusters.push(current);

  const positioned: PositionedEvent[] = [];
  for (const cluster of clusters) {
    // Greedy first-fit lane assignment.
    const lanes: number[] = []; // lanes[i] = end time of last event placed in lane i
    const laneOfEvent = new Map<string, number>();
    for (const ev of cluster) {
      const s = parseISO(ev.start).getTime();
      const e = parseISO(ev.end).getTime();
      let lane = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= s) {
          lane = i;
          lanes[i] = e;
          break;
        }
      }
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(e);
      }
      laneOfEvent.set(ev.id, lane);
    }
    const lanesInCluster = lanes.length;
    for (const ev of cluster) {
      positioned.push({
        event: ev,
        lane: laneOfEvent.get(ev.id)!,
        lanesInCluster,
      });
    }
  }
  return positioned;
}

// ---- Position math -------------------------------------------------------

export function minutesSinceMidnight(iso: string): number {
  const d = parseISO(iso);
  return d.getHours() * 60 + d.getMinutes();
}

// Pixel offset of an event's start within a day column.
export function topForEvent(start: string): number {
  return (minutesSinceMidnight(start) / 60) * HOUR_HEIGHT;
}

export function heightForEvent(start: string, end: string): number {
  const mins = differenceInMinutes(parseISO(end), parseISO(start), {
    roundingMethod: "ceil",
  });
  return Math.max(20, (mins / 60) * HOUR_HEIGHT);
}

// ---- Formatting ----------------------------------------------------------

export function fmtTime(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

export function fmtTimeShort(iso: string): string {
  return format(parseISO(iso), "h:mm a").toLowerCase();
}

export function fmtDuration(start: string, end: string): string {
  const mins = differenceInMinutes(parseISO(end), parseISO(start));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function isToday(iso: string): boolean {
  return isSameDay(parseISO(iso), new Date());
}

// Snap minutes-since-midnight to nearest `step` minutes (default 15).
export function snapMins(mins: number, step = 15): number {
  return Math.round(mins / step) * step;
}

// Split events that cross midnight into per-day chunks so each renders within
// a single day column (mirrors iOS Calendar). An event from 22:50→06:50 becomes
// two chunks: 22:50→00:00 (on the start day) and 00:00→06:50 (on the next day).
// All-day events pass through unchanged.
export function splitOvernightEvents(events: CalendarEvent[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    if (ev.allDay) {
      out.push(ev);
      continue;
    }
    const start = parseISO(ev.start);
    const end = parseISO(ev.end);
    if (isSameDay(start, end)) {
      out.push(ev);
      continue;
    }
    // Split into per-day chunks. Walk from start day to end day.
    let cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    let chunkIdx = 0;
    while (cursor < end) {
      const dayEnd = new Date(cursor);
      dayEnd.setDate(dayEnd.getDate() + 1); // midnight = start of next day
      const chunkStart = cursor < start ? start : cursor;
      const chunkEnd = dayEnd < end ? dayEnd : end;
      if (chunkStart < chunkEnd) {
        out.push({
          ...ev,
          id: `${ev.id}#night${chunkIdx}`,
          start: chunkStart.toISOString(),
          end: chunkEnd.toISOString(),
        });
      }
      cursor = dayEnd;
      chunkIdx++;
    }
  }
  return out;
}

// Detect pairs of events that overlap in time (and aren't allowed-overlap
// pairs like laundry+work). Returns a Set of event IDs that are in conflict.
// An event with allowOverlap=true (e.g. laundry) is NOT in conflict with
// any event whose locationType matches or is "any" — it can coexist.
export function conflictingEventIds(events: CalendarEvent[]): Set<string> {
  const ids = new Set<string>();
  // sort by start
  const sorted = [...events].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  );
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      // once b starts at/after a ends, no further overlaps for this i
      if (parseISO(b.start).getTime() >= parseISO(a.end).getTime()) break;
      // allowed-overlap pairs:
      //  - both allow overlap (laundry + work)
      //  - one allows overlap AND they share a compatible location
      //    (laundry at home can overlap any home event)
      const aCanOverlap = a.allowOverlap;
      const bCanOverlap = b.allowOverlap;
      const sameLocation =
        a.locationType === b.locationType ||
        a.locationType === "any" ||
        b.locationType === "any";
      if (aCanOverlap && bCanOverlap) continue;
      if (aCanOverlap && sameLocation) continue;
      if (bCanOverlap && sameLocation) continue;
      ids.add(a.id);
      ids.add(b.id);
    }
  }
  return ids;
}

// Category → human label, used in the edit sheet badge.
export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    lecture: "Lecture",
    sport: "Sport",
    travel: "Travel",
    sleep: "Sleep",
    work: "Paid work",
    homework: "Homework",
    language: "Language",
    coding: "Coding",
    ppl: "PPL theory",
    cubing: "Cubing",
    laundry: "Laundry",
    shopping: "Shopping",
    cooking: "Cooking",
    social: "Social",
    free: "Free",
    other: "Other",
  };
  return map[category] ?? "Other";
}

// Convenience: convert (day Date, hour, minute) into a local ISO string.
export function isoFromTime(day: Date, hour: number, minute: number): string {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

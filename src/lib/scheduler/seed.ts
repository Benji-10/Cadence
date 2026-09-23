// The user's real university schedule, encoded as weekly-recurring courses plus
// a few one-off life blocks. All times are LOCAL (not UTC) — "08:00" means
// 08:00 in whatever timezone the browser is in.
//
// Each course is a single recurring event with `daysOfWeek` so the calendar
// shows every session (Mon, Wed, Fri, …) without duplicating rows in the DB.
// The recurrence expander in `recurrence.ts` materialises the occurrences.
//
// Room numbers live in `notes` because OpenStreetMap (used by the location
// autocomplete) doesn't index room numbers — only building addresses. The
// `location` field gets the searchable building address; `notes` gets the
// room, which is what you actually need once you're inside the building.

import { inferMetaFromTitle } from "./categories";
import type { RecurrenceRule } from "../types";

export interface SeedEntry {
  /** 0 = Monday of week 1 … 6 = Sunday of week 1, 7..13 = week 2.
   *  For recurring entries this is the day of the FIRST occurrence. */
  day: number;
  /** minutes since local midnight */
  startMins: number;
  endMins: number;
  endDayOffset?: 0 | 1; // for overnight events
  title: string;
  location?: string;
  notes?: string;
  /** When set, this entry recurs weekly on the given days-of-week
   *  (0=Sun … 6=Sat) until `recurrenceUntil`. */
  daysOfWeek?: number[];
  recurrenceUntil?: string; // ISO date — end of semester
  alerts?: number[]; // override default [-30, -10, 0]
}

const slot = (
  day: number,
  start: string,
  end: string,
  title: string,
  opts: { location?: string; notes?: string; daysOfWeek?: number[]; recurrenceUntil?: string; alerts?: number[] } = {}
): SeedEntry => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return {
    day,
    startMins,
    endMins,
    endDayOffset: endMins <= startMins ? 1 : 0,
    title,
    location: opts.location,
    notes: opts.notes,
    daysOfWeek: opts.daysOfWeek,
    recurrenceUntil: opts.recurrenceUntil,
    alerts: opts.alerts,
  };
};

// ── Locations ────────────────────────────────────────────────────────────────
// Building addresses are real & searchable in OpenStreetMap. Room numbers go
// in `notes` because OSM doesn't index rooms.
const ZACHRY = "Zachry Engineering Education Complex, 125 Spence St, College Station, TX 77843";
const EAB = "Engineering Activities Building B, 620 Lamar St, College Station, TX 77843";
const PEAP = "Physical Education Activity Program Building, 632 Penberthy Blvd, College Station, TX 77840";

// ── Semester end ────────────────────────────────────────────────────────────
// Recurring courses expand weekly until this date. Texas A&M fall semester
// typically ends mid-December; set a generous default so courses keep
// appearing through finals.
function defaultSemesterEnd(): string {
  const now = new Date();
  // End of the day on December 20 of the current year.
  const end = new Date(now.getFullYear(), 11, 20, 23, 59, 0);
  // If we're already past Dec 20, roll to next year (spring semester).
  if (now.getTime() > end.getTime()) {
    return new Date(now.getFullYear() + 1, 4, 10, 23, 59, 0).toISOString();
  }
  return end.toISOString();
}

const SEMESTER_END = defaultSemesterEnd();

// ── Course schedule (Mon–Fri, recurring weekly) ────────────────────────────
// Each course appears once here; `daysOfWeek` controls which days it expands
// to. The first occurrence is anchored to the Monday of the current week so
// the calendar shows sessions immediately.
//
// Day numbers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const COURSES: SeedEntry[] = [
  // CSCE 312-500 Computer Organization — Mon & Wed 8:00–8:50 AM, Room 584
  slot(1, "08:00", "08:50", "CSCE 312 Computer Organization", {
    location: ZACHRY,
    notes: "Room 584",
    daysOfWeek: [1, 3], // Mon, Wed
    recurrenceUntil: SEMESTER_END,
  }),
  // CSCE 312-500 Computer Organization — Mon & Wed 11:30 AM–12:20 PM, Room 310
  slot(1, "11:30", "12:20", "CSCE 312 Computer Organization", {
    location: ZACHRY,
    notes: "Room 310",
    daysOfWeek: [1, 3],
    recurrenceUntil: SEMESTER_END,
  }),
  // CSCE 314-500 Programming Languages — Mon, Wed, Fri 1:50–2:40 PM, Room 350
  slot(1, "13:50", "14:40", "CSCE 314 Programming Languages", {
    location: ZACHRY,
    notes: "Room 350",
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    recurrenceUntil: SEMESTER_END,
  }),
  // CSCE 421-500 Machine Learning — Mon & Wed 4:10–5:25 PM, Room 106 (EAB)
  slot(1, "16:10", "17:25", "CSCE 421 Machine Learning", {
    location: EAB,
    notes: "Room 106",
    daysOfWeek: [1, 3],
    recurrenceUntil: SEMESTER_END,
  }),
  // CSCE 441-500 Computer Graphics — Tue & Thu 2:20–3:35 PM, Room 106 (EAB)
  slot(2, "14:20", "15:35", "CSCE 441 Computer Graphics", {
    location: EAB,
    notes: "Room 106",
    daysOfWeek: [2, 4], // Tue, Thu
    recurrenceUntil: SEMESTER_END,
  }),
  // KINE-199-067 Badminton Beginners — Tue 4:25–5:40 PM, Room 132 (PEAP)
  slot(2, "16:25", "17:40", "KINE 199 Badminton Beginners", {
    location: PEAP,
    notes: "Room 132",
    daysOfWeek: [2],
    recurrenceUntil: SEMESTER_END,
  }),
];

// ── Supporting life blocks (recurring weekly, no room number) ───────────────
// These keep the calendar realistic so the auto-optimiser and travel-time
// features have something to work with. Times are local.
const LIFE_BLOCKS: SeedEntry[] = [
  // Sleep — Mon night → Tue morning (encodes overnight via endDayOffset)
  slot(0, "23:00", "07:00", "Sleep", { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], recurrenceUntil: SEMESTER_END }),
  // Evenings — cook + dinner
  slot(0, "18:30", "20:00", "Cook + dinner", { daysOfWeek: [1, 3], recurrenceUntil: SEMESTER_END }),
  slot(2, "18:30", "20:00", "Cook + dinner", { daysOfWeek: [2, 4], recurrenceUntil: SEMESTER_END }),
  slot(4, "18:30", "20:00", "Cook + dinner", { daysOfWeek: [5], recurrenceUntil: SEMESTER_END }),
  // Homework blocks on non-class mornings
  slot(0, "09:00", "11:00", "Homework", { daysOfWeek: [2, 4, 5], recurrenceUntil: SEMESTER_END }),
  // Personal coding / project time
  slot(0, "20:00", "22:00", "Personal app coding", { daysOfWeek: [1, 3, 5], recurrenceUntil: SEMESTER_END }),
];

// Combine: courses first (so they render prominently), then life blocks.
export const SEED_ENTRIES: SeedEntry[] = [...COURSES, ...LIFE_BLOCKS];

// ── Time resolution (LOCAL, not UTC) ─────────────────────────────────────────
// The old version added milliseconds to a UTC epoch, which meant "08:00" in
// the seed became 08:00 UTC — wrong local time in any non-UTC timezone.
//
// The fix: build the Date from LOCAL components (year, month, day, hour, min)
// using the Monday-of-this-week as the anchor. `new Date(y, m, d, h, mi)`
// respects the browser's timezone, so "08:00" in the seed is 08:00 local.
export function resolveSeedTimes(
  entry: SeedEntry,
  weekStartMonday: Date
): { start: Date; end: Date } {
  // Clone the Monday and advance to the entry's day.
  const startDay = new Date(weekStartMonday);
  startDay.setDate(startDay.getDate() + entry.day);
  startDay.setHours(Math.floor(entry.startMins / 60), entry.startMins % 60, 0, 0);

  const endDay = new Date(weekStartMonday);
  endDay.setDate(endDay.getDate() + entry.day + (entry.endDayOffset ?? 0));
  endDay.setHours(Math.floor(entry.endMins / 60), entry.endMins % 60, 0, 0);

  return { start: startDay, end: endDay };
}

// Build the recurrence rule for a seed entry (or null if one-off).
export function recurrenceForSeed(entry: SeedEntry): RecurrenceRule | null {
  if (!entry.daysOfWeek || entry.daysOfWeek.length === 0) return null;
  return {
    freq: "weekly",
    interval: 1,
    until: entry.recurrenceUntil,
    daysOfWeek: entry.daysOfWeek,
  };
}

// Pre-compute the inferred meta for a seed title so the seeder writes full rows.
export function metaForTitle(title: string) {
  return inferMetaFromTitle(title);
}

// Exported so the seeder can log/validate the semester end.
export const SEED_SEMESTER_END = SEMESTER_END;

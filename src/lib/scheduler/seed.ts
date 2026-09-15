// The user's two-week starter schedule, encoded as relative day offsets so the
// calendar always shows "this week and next week" from whenever it's seeded.
//
// Each entry is { day: 0..13 (Mon of week 1 = 0), startMins, endMins, title }.
// startMins/endMins are minutes since local midnight. Times that cross
// midnight (e.g. 22:50→06:50 sleep) are encoded with the END on the following
// day using a `dayOffset` of +1.

import { inferMetaFromTitle } from "./categories";

export interface SeedEntry {
  day: number; // 0 = Monday week 1 ... 6 = Sunday week 1, 7..13 = week 2
  startMins: number;
  endMins: number;
  endDayOffset?: 0 | 1; // for overnight events
  title: string;
  location?: string;
}

// Helper to build a slot quickly.
const slot = (
  day: number,
  start: string,
  end: string,
  title: string,
  location?: string
): SeedEntry => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return {
    day,
    startMins: sh * 60 + sm,
    endMins: eh * 60 + em,
    endDayOffset: eh * 60 + em <= sh * 60 + sm ? 1 : 0,
    title,
    location,
  };
};

// ---- WEEK 1 --------------------------------------------------------------
const WEEK1: SeedEntry[] = [
  // MONDAY
  slot(0, "07:00", "08:00", "Get ready + travel", "Home → Campus"),
  slot(0, "08:00", "08:50", "Computer Organization", "Campus"),
  slot(0, "08:50", "10:50", "Paid work", "Campus"),
  slot(0, "10:50", "11:20", "Homework", "Campus"),
  slot(0, "11:30", "12:20", "Computer Organization", "Campus"),
  slot(0, "12:20", "13:20", "Homework / assignment", "Campus"),
  slot(0, "13:50", "14:40", "Programming Languages", "Campus"),
  slot(0, "14:40", "15:40", "Paid work", "Campus"),
  slot(0, "15:40", "16:10", "Break", "Campus"),
  slot(0, "16:10", "17:25", "Machine Learning", "Campus"),
  slot(0, "17:30", "19:30", "Volleyball / badminton", "Sports Centre"),
  slot(0, "19:30", "20:00", "Travel home", "Sports Centre → Home"),
  slot(0, "20:00", "22:00", "Cook + dinner", "Home"),
  slot(0, "22:00", "23:00", "Shower / free", "Home"),
  slot(0, "01:00", "09:00", "Sleep", "Home"),
  // TUESDAY
  slot(1, "09:00", "11:00", "Paid work", "Home"),
  slot(1, "11:00", "12:00", "Cubing / recording", "Home"),
  slot(1, "12:00", "13:00", "Personal app coding", "Home"),
  slot(1, "13:00", "13:40", "Get ready", "Home"),
  slot(1, "13:40", "14:20", "Travel to campus", "Home → Campus"),
  slot(1, "14:20", "15:35", "Computer Graphics", "Campus"),
  slot(1, "15:35", "16:25", "Warm-up / transition", "Campus → Sports Centre"),
  slot(1, "16:25", "17:50", "Badminton Beginning", "Sports Centre"),
  slot(1, "17:50", "20:00", "Additional badminton / volleyball", "Sports Centre"),
  slot(1, "20:00", "20:40", "Travel home", "Sports Centre → Home"),
  slot(1, "20:40", "22:00", "Cook + dinner", "Home"),
  slot(1, "22:00", "22:50", "Watch / review sport footage", "Home"),
  slot(1, "22:50", "23:00", "Get ready for bed", "Home"),
  slot(1, "22:50", "06:50", "Sleep", "Home"),
  // WEDNESDAY
  slot(2, "08:00", "08:50", "Computer Organization", "Campus"),
  slot(2, "08:50", "10:50", "Paid work", "Campus"),
  slot(2, "10:50", "11:20", "Homework", "Campus"),
  slot(2, "11:30", "12:20", "Computer Organization", "Campus"),
  slot(2, "12:20", "13:20", "Language study", "Campus"),
  slot(2, "13:20", "13:50", "Break", "Campus"),
  slot(2, "13:50", "14:40", "Programming Languages", "Campus"),
  slot(2, "14:40", "15:40", "Personal app coding", "Home"),
  slot(2, "15:40", "16:10", "Break", "Home"),
  slot(2, "16:10", "17:25", "Machine Learning", "Campus"),
  slot(2, "17:25", "18:00", "Travel home", "Campus → Home"),
  slot(2, "18:00", "20:00", "Cook + dinner", "Home"),
  slot(2, "20:00", "22:00", "Paid work", "Home"),
  slot(2, "22:00", "23:00", "Language study", "Home"),
  slot(2, "23:00", "01:00", "Free time", "Home"),
  slot(2, "01:00", "09:00", "Sleep", "Home"),
  // THURSDAY
  slot(3, "09:00", "11:00", "Paid work", "Home"),
  slot(3, "11:00", "12:00", "Homework", "Home"),
  slot(3, "12:00", "13:00", "Language study", "Home"),
  slot(3, "13:00", "13:40", "Cubing / recording", "Home"),
  slot(3, "13:40", "14:20", "Travel to campus", "Home → Campus"),
  slot(3, "14:20", "15:35", "Computer Graphics", "Campus"),
  slot(3, "15:35", "16:00", "Transition / warm-up", "Campus → Sports Centre"),
  slot(3, "16:00", "20:00", "Volleyball / badminton", "Sports Centre"),
  slot(3, "20:00", "20:40", "Travel home", "Sports Centre → Home"),
  slot(3, "20:40", "22:40", "Cook + dinner", "Home"),
  slot(3, "22:40", "23:40", "Cubing / recording", "Home"),
  slot(3, "23:40", "01:00", "Free / shower", "Home"),
  slot(3, "01:00", "09:00", "Sleep", "Home"),
  // FRIDAY
  slot(4, "09:00", "11:00", "Paid work", "Home"),
  slot(4, "11:00", "12:00", "Cubing / recording", "Home"),
  slot(4, "12:00", "13:00", "Homework", "Home"),
  slot(4, "13:00", "13:50", "Travel to campus", "Home → Campus"),
  slot(4, "13:50", "14:40", "Programming Languages", "Campus"),
  slot(4, "14:40", "15:20", "Travel home", "Campus → Home"),
  slot(4, "15:20", "17:00", "Laundry", "Home"),
  slot(4, "17:00", "18:00", "Personal app coding", "Home"),
  slot(4, "18:00", "20:00", "Cook + dinner", "Home"),
  slot(4, "20:00", "02:00", "Friends / social", "Out"),
  slot(4, "02:00", "10:00", "Sleep", "Home"),
  // SATURDAY
  slot(5, "10:00", "11:00", "Cubing / recording", "Home"),
  slot(5, "11:00", "14:00", "Paid work", "Home"),
  slot(5, "14:00", "14:30", "Travel to campus", "Home → Sports Centre"),
  slot(5, "14:30", "19:30", "Long volleyball / badminton", "Sports Centre"),
  slot(5, "19:30", "20:10", "Travel home", "Sports Centre → Home"),
  slot(5, "20:10", "22:10", "Cook + dinner", "Home"),
  slot(5, "22:10", "00:10", "UK PPL theory", "Home"),
  slot(5, "00:10", "01:00", "Anything block", "Home"),
  slot(5, "01:00", "09:00", "Sleep", "Home"),
  // SUNDAY
  slot(6, "09:00", "10:40", "Laundry", "Home"),
  slot(6, "10:40", "12:10", "Weekly shopping", "Out"),
  slot(6, "12:10", "14:10", "Paid work", "Home"),
  slot(6, "14:10", "15:40", "Language study", "Home"),
  slot(6, "15:40", "17:10", "Homework", "Home"),
  slot(6, "17:10", "19:10", "Cook + dinner", "Home"),
  slot(6, "19:10", "21:10", "UK PPL theory", "Home"),
  slot(6, "21:10", "22:10", "Cubing / recording", "Home"),
  slot(6, "22:10", "23:00", "Prepare for Monday", "Home"),
  slot(6, "23:00", "07:00", "Sleep", "Home"),
];

// ---- WEEK 2 --------------------------------------------------------------
const WEEK2: SeedEntry[] = [
  // MONDAY (day 7)
  slot(7, "07:00", "08:00", "Get ready + travel", "Home → Campus"),
  slot(7, "08:00", "08:50", "Computer Organization", "Campus"),
  slot(7, "08:50", "10:50", "Paid work", "Campus"),
  slot(7, "10:50", "11:20", "Homework", "Campus"),
  slot(7, "11:30", "12:20", "Computer Organization", "Campus"),
  slot(7, "12:20", "13:20", "Homework / assignment", "Campus"),
  slot(7, "13:50", "14:40", "Programming Languages", "Campus"),
  slot(7, "14:40", "15:40", "Paid work", "Campus"),
  slot(7, "16:10", "17:25", "Machine Learning", "Campus"),
  slot(7, "17:30", "19:30", "Volleyball / badminton", "Sports Centre"),
  slot(7, "19:30", "20:00", "Travel home", "Sports Centre → Home"),
  slot(7, "20:00", "22:00", "Cook + dinner", "Home"),
  slot(7, "22:00", "23:00", "Shower / free", "Home"),
  slot(7, "01:00", "09:00", "Sleep", "Home"),
  // TUESDAY (day 8)
  slot(8, "09:00", "11:00", "Paid work", "Home"),
  slot(8, "11:00", "12:00", "Cubing / recording", "Home"),
  slot(8, "12:00", "13:00", "Personal app coding", "Home"),
  slot(8, "13:00", "13:40", "Get ready", "Home"),
  slot(8, "13:40", "14:20", "Travel to campus", "Home → Campus"),
  slot(8, "14:20", "15:35", "Computer Graphics", "Campus"),
  slot(8, "15:35", "16:25", "Warm-up / transition", "Campus → Sports Centre"),
  slot(8, "16:25", "17:50", "Badminton Beginning", "Sports Centre"),
  slot(8, "17:50", "20:00", "Additional badminton / volleyball", "Sports Centre"),
  slot(8, "20:00", "20:40", "Travel home", "Sports Centre → Home"),
  slot(8, "20:40", "22:00", "Cook + dinner", "Home"),
  slot(8, "22:00", "22:50", "Watch / review sport footage", "Home"),
  slot(8, "22:50", "23:00", "Get ready for bed", "Home"),
  slot(8, "22:50", "06:50", "Sleep", "Home"),
  // WEDNESDAY (day 9)
  slot(9, "08:00", "08:50", "Computer Organization", "Campus"),
  slot(9, "08:50", "10:50", "Paid work", "Campus"),
  slot(9, "10:50", "11:20", "Homework", "Campus"),
  slot(9, "11:30", "12:20", "Computer Organization", "Campus"),
  slot(9, "12:20", "13:20", "Language study", "Campus"),
  slot(9, "13:50", "14:40", "Programming Languages", "Campus"),
  slot(9, "14:40", "15:40", "Personal app coding", "Home"),
  slot(9, "16:10", "17:25", "Machine Learning", "Campus"),
  slot(9, "17:25", "18:00", "Travel home", "Campus → Home"),
  slot(9, "18:00", "20:00", "Cook + dinner", "Home"),
  slot(9, "20:00", "22:00", "Paid work", "Home"),
  slot(9, "22:00", "23:00", "Language study", "Home"),
  slot(9, "23:00", "01:00", "Free time", "Home"),
  slot(9, "01:00", "09:00", "Sleep", "Home"),
  // THURSDAY (day 10)
  slot(10, "09:00", "11:00", "Homework", "Home"),
  slot(10, "11:00", "12:30", "Paid work", "Home"),
  slot(10, "12:30", "13:15", "Cubing / recording", "Home"),
  slot(10, "13:15", "14:20", "Travel to campus", "Home → Campus"),
  slot(10, "14:20", "15:35", "Computer Graphics", "Campus"),
  slot(10, "15:35", "16:00", "Transition / warm-up", "Campus → Sports Centre"),
  slot(10, "16:00", "20:00", "Volleyball / badminton", "Sports Centre"),
  slot(10, "20:00", "20:40", "Travel home", "Sports Centre → Home"),
  slot(10, "20:40", "22:40", "Cook + dinner", "Home"),
  slot(10, "22:40", "23:40", "Cubing / recording", "Home"),
  slot(10, "23:40", "00:30", "Language study", "Home"),
  slot(10, "01:00", "09:00", "Sleep", "Home"),
  // FRIDAY (day 11)
  slot(11, "09:00", "11:00", "Paid work", "Home"),
  slot(11, "11:00", "12:00", "Cubing / recording", "Home"),
  slot(11, "12:00", "13:20", "Homework", "Home"),
  slot(11, "13:20", "13:50", "Travel to campus", "Home → Campus"),
  slot(11, "13:50", "14:40", "Programming Languages", "Campus"),
  slot(11, "14:40", "15:20", "Travel home", "Campus → Home"),
  slot(11, "15:20", "16:20", "Personal app coding", "Home"),
  slot(11, "16:20", "17:20", "Laundry", "Home"),
  slot(11, "17:20", "19:20", "Cook + dinner", "Home"),
  slot(11, "19:20", "02:00", "Friends / social", "Out"),
  slot(11, "02:00", "10:00", "Sleep", "Home"),
  // SATURDAY (day 12)
  slot(12, "10:00", "11:00", "Cubing / recording", "Home"),
  slot(12, "11:00", "14:00", "Paid work", "Home"),
  slot(12, "14:00", "14:30", "Travel to campus", "Home → Sports Centre"),
  slot(12, "14:30", "19:30", "Long volleyball / badminton", "Sports Centre"),
  slot(12, "19:30", "20:10", "Travel home", "Sports Centre → Home"),
  slot(12, "20:10", "22:10", "Cook + dinner", "Home"),
  slot(12, "22:10", "01:10", "UK PPL theory", "Home"),
  slot(12, "01:10", "02:00", "Anything block", "Home"),
  slot(12, "02:00", "10:00", "Sleep", "Home"),
  // SUNDAY (day 13)
  slot(13, "10:00", "11:30", "Language study", "Home"),
  slot(13, "11:30", "13:10", "Laundry", "Home"),
  slot(13, "13:10", "14:40", "Weekly shopping", "Out"),
  slot(13, "14:40", "17:40", "Paid work", "Home"),
  slot(13, "17:40", "19:10", "Homework", "Home"),
  slot(13, "19:10", "21:10", "Volleyball / badminton", "Sports Centre"),
  slot(13, "21:10", "21:50", "Travel home", "Sports Centre → Home"),
  slot(13, "21:50", "23:50", "Cook + dinner", "Home"),
  slot(13, "23:50", "00:50", "Language study", "Home"),
  slot(13, "00:50", "01:30", "Cubing / recording", "Home"),
  slot(13, "23:00", "07:00", "Sleep", "Home"),
];

export const SEED_ENTRIES: SeedEntry[] = [...WEEK1, ...WEEK2];

// Turn a seed entry into concrete start/end ISO strings, anchored to the
// Monday of "this week" at 00:00 local.
export function resolveSeedTimes(
  entry: SeedEntry,
  weekStartMondayMs: number
): { start: Date; end: Date } {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(weekStartMondayMs + entry.day * dayMs + entry.startMins * 60 * 1000);
  const endOffset = (entry.endDayOffset ?? 0) * dayMs;
  const end = new Date(
    weekStartMondayMs + entry.day * dayMs + endOffset + entry.endMins * 60 * 1000
  );
  return { start, end };
}

// Pre-compute the inferred meta for a seed title so the seeder writes full rows.
export function metaForTitle(title: string) {
  return inferMetaFromTitle(title);
}

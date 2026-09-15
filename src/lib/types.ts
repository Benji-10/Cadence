// Shared domain types for the intelligent calendar.
// These mirror the Prisma models but are framework-agnostic and used by both
// the client and the scheduling engine.

export type Flexibility = "fixed" | "movable" | "flexible";

export type EventCategory =
  | "lecture"
  | "sport"
  | "travel"
  | "sleep"
  | "work"
  | "homework"
  | "language"
  | "coding"
  | "ppl"
  | "cubing"
  | "laundry"
  | "shopping"
  | "cooking"
  | "social"
  | "free"
  | "other";

export type LocationType = "home" | "campus" | "sports" | "out" | "any";

export type CalendarKind =
  | "work"
  | "study"
  | "sport"
  | "home"
  | "social"
  | "personal";

export interface Calendar {
  id: string;
  name: string;
  color: string;
  kind: CalendarKind;
  userId?: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string; // ISO string
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
  timezone?: string | null;
  calendarId: string;
  category: EventCategory;
  flexibility: Flexibility;
  locationType: LocationType;
  minChunkMins: number;
  allowOverlap: boolean;
  priority: number;
  travelMins: number;
  color?: string | null;
  alerts: number[]; // minutes-before
  recurrence?: RecurrenceRule | null;
}

export interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  until?: string;
  daysOfWeek?: number[]; // 0 = Sunday ... 6 = Saturday
}

export interface CalendarWithEvents extends Calendar {
  events: CalendarEvent[];
}

// Result of validating a proposed move/resize.
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  conflicts: CalendarEvent[]; // fixed events that overlap the proposed window
}

export interface AvailableSlot {
  start: string;
  end: string;
  durationMins: number;
  locationType: LocationType; // inferred context of the gap
}

export interface ReorderChange {
  eventId: string;
  fromStart: string;
  toStart: string;
  fromEnd: string;
  toEnd: string;
  reason: string;
}

export interface ReorderResult {
  events: CalendarEvent[];
  changes: ReorderChange[];
  notes: string[];
}

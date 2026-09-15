// Convert between Prisma rows (alerts/recurrence stored as JSON text) and the
// clean CalendarEvent domain type used throughout the app.

import type { Calendar, CalendarEvent, Event as PrismaEvent, Prisma } from "@prisma/client";
import type { CalendarKind, RecurrenceRule } from "./types";

type PrismaCalendarWithEvents = Prisma.CalendarGetPayload<{
  include: { events: true };
}>;

export function parseAlerts(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((n) => Number(n)).filter((n) => !Number.isNaN(n)) : [];
  } catch {
    return [];
  }
}

export function parseRecurrence(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as RecurrenceRule) : null;
  } catch {
    return null;
  }
}

export function eventToDomain(row: PrismaEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start.toISOString(),
    end: row.end.toISOString(),
    allDay: row.allDay,
    location: row.location ?? null,
    notes: row.notes ?? null,
    timezone: row.timezone ?? null,
    calendarId: row.calendarId,
    category: row.category as CalendarEvent["category"],
    flexibility: row.flexibility as CalendarEvent["flexibility"],
    locationType: row.locationType as CalendarEvent["locationType"],
    minChunkMins: row.minChunkMins,
    allowOverlap: row.allowOverlap,
    priority: row.priority,
    travelMins: row.travelMins,
    color: row.color ?? null,
    alerts: parseAlerts(row.alerts),
    recurrence: parseRecurrence(row.recurrence),
  };
}

export function calendarToDomain(row: Calendar): Calendar {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    kind: row.kind as CalendarKind,
    userId: row.userId ?? undefined,
  };
}

export function calendarWithEventsToDomain(row: PrismaCalendarWithEvents) {
  return {
    ...calendarToDomain(row),
    events: row.events.map(eventToDomain),
  };
}

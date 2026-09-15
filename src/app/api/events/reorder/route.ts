import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoReorderWeek, rescheduleAround } from "@/lib/scheduler";
import type { CalendarEvent } from "@/lib/types";

// POST /api/events/reorder
// Body: { mode: "week" | "around", rangeStart, rangeEnd, anchor?, newStart?, newEnd? }
// Returns the proposed reordering (does NOT persist — the client confirms and
// saves each moved event via PATCH, which keeps the diff auditable).
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    mode: "week" | "around";
    rangeStart: string;
    rangeEnd: string;
    events?: CalendarEvent[];
    anchor?: CalendarEvent;
    newStart?: string;
    newEnd?: string;
  };

  // Fetch events for the range if not supplied.
  let events = body.events;
  if (!events) {
    const rows = await db.event.findMany({
      where: {
        start: { gte: new Date(body.rangeStart) },
        end: { lte: new Date(body.rangeEnd) },
      },
    });
    events = rows.map((r) => ({
      id: r.id,
      title: r.title,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
      allDay: r.allDay,
      location: r.location ?? null,
      notes: r.notes ?? null,
      timezone: r.timezone ?? null,
      calendarId: r.calendarId,
      category: r.category as CalendarEvent["category"],
      flexibility: r.flexibility as CalendarEvent["flexibility"],
      locationType: r.locationType as CalendarEvent["locationType"],
      minChunkMins: r.minChunkMins,
      allowOverlap: r.allowOverlap,
      priority: r.priority,
      travelMins: r.travelMins,
      color: r.color ?? null,
      alerts: JSON.parse(r.alerts || "[]"),
      recurrence: r.recurrence ? JSON.parse(r.recurrence) : null,
    }));
  }

  const result =
    body.mode === "around" && body.anchor && body.newStart && body.newEnd
      ? rescheduleAround(
          body.anchor,
          body.newStart,
          body.newEnd,
          events,
          body.rangeStart,
          body.rangeEnd
        )
      : autoReorderWeek(events, body.rangeStart, body.rangeEnd);

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventToDomain } from "@/lib/mappers";
import { applyInferredMeta } from "@/lib/scheduler";
import type { CalendarEvent } from "@/lib/types";

// GET /api/events?from=ISO&to=ISO  — list events in a range
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  // Get user ID from Netlify Identity (via the netlify function context).
  // For now, we don't gate — all events are shared. Once Identity is wired
  // server-side, filter by userId.
  const where: { start?: { gte: Date }; end?: { lte: Date } } = {};
  if (from) where.start = { gte: new Date(from) };
  if (to) where.end = { lte: new Date(to) };

  const events = await db.event.findMany({
    where,
    orderBy: { start: "asc" },
  });
  return NextResponse.json({ events: events.map(eventToDomain) });
}

// POST /api/events  — create a new event (with auto-inferred intelligence metadata)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CalendarEvent> & {
    title: string;
    start: string;
    end: string;
    calendarId: string;
  };

  const inferred = applyInferredMeta(body);
  const calendar = await db.calendar.findUnique({
    where: { id: body.calendarId },
  });
  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const created = await db.event.create({
    data: {
      title: body.title,
      start: new Date(body.start),
      end: new Date(body.end),
      allDay: body.allDay ?? false,
      location: body.location ?? null,
      notes: body.notes ?? null,
      timezone: body.timezone ?? null,
      calendarId: body.calendarId,
      category: inferred.category ?? "other",
      flexibility: inferred.flexibility ?? "movable",
      locationType: inferred.locationType ?? "any",
      minChunkMins: inferred.minChunkMins ?? 30,
      allowOverlap: inferred.allowOverlap ?? false,
      priority: body.priority ?? 0,
      travelMins: body.travelMins ?? 0,
      color: body.color ?? null,
      alerts: JSON.stringify(body.alerts ?? [-30, -10, 0]),
      recurrence: body.recurrence ? JSON.stringify(body.recurrence) : null,
    },
  });

  return NextResponse.json({ event: eventToDomain(created) }, { status: 201 });
}

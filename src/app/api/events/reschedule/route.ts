import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBestSlot } from "@/lib/scheduler";
import type { CalendarEvent } from "@/lib/types";

// POST /api/events/suggest
// Body: { task: { category, locationType, minChunkMins, flexibility, title }, durationMins, rangeStart, rangeEnd, aroundEvents? }
// Returns the best placement plan for a task.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    task: {
      category: string;
      locationType: CalendarEvent["locationType"];
      minChunkMins: number;
      flexibility: string;
    };
    durationMins: number;
    rangeStart: string;
    rangeEnd: string;
    aroundEvents?: CalendarEvent[];
  };

  let events = body.aroundEvents;
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

  const plan = findBestSlot(
    body.task,
    body.durationMins,
    events,
    body.rangeStart,
    body.rangeEnd
  );

  return NextResponse.json({ plan });
}

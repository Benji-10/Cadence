import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventToDomain } from "@/lib/mappers";
import { applyInferredMeta } from "@/lib/scheduler";
import type { CalendarEvent } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ event: eventToDomain(event) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as Partial<CalendarEvent>;

  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If the title changed, re-run inference so category/flexibility follow the
  // new wording (unless the caller explicitly overrode them).
  const reInfer =
    body.title !== undefined && body.title !== existing.title;
  const merged = reInfer
    ? applyInferredMeta(
        { ...(body as Partial<CalendarEvent> & { title: string }), title: body.title! },
        { respectExisting: true }
      )
    : body;

  const updated = await db.event.update({
    where: { id },
    data: {
      ...(merged.title !== undefined ? { title: merged.title } : {}),
      ...(merged.start !== undefined ? { start: new Date(merged.start) } : {}),
      ...(merged.end !== undefined ? { end: new Date(merged.end) } : {}),
      ...(merged.allDay !== undefined ? { allDay: merged.allDay } : {}),
      ...(merged.location !== undefined ? { location: merged.location } : {}),
      ...(merged.notes !== undefined ? { notes: merged.notes } : {}),
      ...(merged.timezone !== undefined ? { timezone: merged.timezone } : {}),
      ...(merged.calendarId !== undefined ? { calendarId: merged.calendarId } : {}),
      ...(merged.category !== undefined ? { category: merged.category } : {}),
      ...(merged.flexibility !== undefined ? { flexibility: merged.flexibility } : {}),
      ...(merged.locationType !== undefined ? { locationType: merged.locationType } : {}),
      ...(merged.minChunkMins !== undefined ? { minChunkMins: merged.minChunkMins } : {}),
      ...(merged.allowOverlap !== undefined ? { allowOverlap: merged.allowOverlap } : {}),
      ...(merged.priority !== undefined ? { priority: merged.priority } : {}),
      ...(merged.travelMins !== undefined ? { travelMins: merged.travelMins } : {}),
      ...(merged.color !== undefined ? { color: merged.color } : {}),
      ...(merged.alerts !== undefined ? { alerts: JSON.stringify(merged.alerts) } : {}),
      ...(merged.recurrence !== undefined
        ? { recurrence: merged.recurrence ? JSON.stringify(merged.recurrence) : null }
        : {}),
    },
  });

  return NextResponse.json({ event: eventToDomain(updated) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.event.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

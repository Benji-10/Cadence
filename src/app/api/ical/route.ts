import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { CalendarEvent, RecurrenceRule } from "@/lib/types";

// GET /api/ical?from=ISO&to=ISO
// Streams an iCalendar (.ics) feed of events. Suitable for importing into
// Apple Calendar / Google Calendar / Outlook.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: { start?: { gte: Date }; end?: { lte: Date } } = {};
  if (from) where.start = { gte: new Date(from) };
  if (to) where.end = { lte: new Date(to) };

  const rows = await db.event.findMany({
    where,
    orderBy: { start: "asc" },
    include: { calendar: true },
  });

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Cadence//Intelligent Calendar//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:Cadence");

  for (const r of rows) {
    const ev: CalendarEvent = {
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
      alerts: r.alerts ? (JSON.parse(r.alerts) as number[]) : [],
      recurrence: r.recurrence ? (JSON.parse(r.recurrence) as RecurrenceRule) : null,
    };

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@cadence`);
    lines.push(`DTSTAMP:${icsStamp(new Date())}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(parseISO(ev.start))}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(addDay(parseISO(ev.end)))}`);
    } else {
      lines.push(`DTSTART:${icsStamp(parseISO(ev.start))}`);
      lines.push(`DTEND:${icsStamp(parseISO(ev.end))}`);
    }
    lines.push(`SUMMARY:${escapeIcs(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeIcs(ev.notes)}`);
    lines.push(`CATEGORIES:${ev.category}`);

    if (ev.recurrence) {
      lines.push(toRrule(ev.recurrence));
    }

    for (const off of ev.alerts ?? []) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(
        `DESCRIPTION:${escapeIcs(
          off === 0 ? `${ev.title} starts now` : `${ev.title} in ${Math.abs(off)} min`
        )}`
      );
      lines.push(`TRIGGER:-PT${Math.abs(off)}M`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cadence.ics"',
      "Cache-Control": "no-store",
    },
  });
}

function parseISO(iso: string): Date {
  return new Date(iso);
}
function addDay(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + 1);
  return r;
}
function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}
function icsStamp(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
function icsDate(d: Date): string {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
function toRrule(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.freq.toUpperCase()}`];
  parts.push(`INTERVAL=${Math.max(1, rule.interval)}`);
  if (rule.until) parts.push(`UNTIL=${icsStamp(parseISO(rule.until))}`);
  if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const map = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    parts.push(`BYDAY=${rule.daysOfWeek.map((d) => map[d]).join(",")}`);
  }
  return `RRULE:${parts.join(";")}`;
}

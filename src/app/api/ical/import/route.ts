import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyInferredMeta } from "@/lib/scheduler";
import type { CalendarEvent, RecurrenceRule } from "@/lib/types";

// POST /api/ical/import
// Body: { ics: string, calendarId: string }
// Parses an iCalendar (.ics) feed and creates an Event row per VEVENT that
// falls within a sane window (defaults to ±1 year of now). Returns the count
// imported + a sample of titles.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { ics: string; calendarId: string };
  if (!body.ics || !body.calendarId) {
    return NextResponse.json(
      { error: "Missing 'ics' or 'calendarId'" },
      { status: 400 }
    );
  }

  const calendar = await db.calendar.findUnique({
    where: { id: body.calendarId },
  });
  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  const now = Date.now();
  const windowMs = 365 * 24 * 60 * 60 * 1000;
  const minStart = now - windowMs;
  const maxStart = now + windowMs;

  const events = parseIcs(body.ics);
  let imported = 0;
  const titles: string[] = [];

  for (const ev of events) {
    const startMs = ev.start.getTime();
    if (startMs < minStart || startMs > maxStart) continue;

    const title = ev.summary || "Untitled event";
    const inferred = applyInferredMeta({ title });
    const endIsBeforeStart = ev.end.getTime() <= ev.start.getTime();
    const end = endIsBeforeStart ? new Date(ev.start.getTime() + 60 * 60 * 1000) : ev.end;

    await db.event.create({
      data: {
        title,
        start: ev.start,
        end,
        allDay: ev.allDay,
        location: ev.location ?? null,
        notes: ev.description ?? null,
        calendarId: body.calendarId,
        category: inferred.category ?? "other",
        flexibility: inferred.flexibility ?? "movable",
        locationType: inferred.locationType ?? "any",
        minChunkMins: inferred.minChunkMins ?? 30,
        allowOverlap: inferred.allowOverlap ?? false,
        priority: 0,
        travelMins: 0,
        color: null,
        alerts: JSON.stringify(ev.alerts?.length ? ev.alerts : [-30, -10, 0]),
        recurrence: ev.recurrence ? JSON.stringify(ev.recurrence) : null,
      },
    });
    imported++;
    if (titles.length < 6) titles.push(title);
  }

  return NextResponse.json({ imported, titles });
}

interface ParsedVEvent {
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
  alerts: number[];
  recurrence?: RecurrenceRule;
}

// Minimal RFC 5545 parser: unfold lines (RFC 5545 line folding), split into
// VEVENT blocks, and read the properties we care about. Good enough for the
// common .ics exports from Apple/Google/Outlook.
function parseIcs(ics: string): ParsedVEvent[] {
  // Unfold continuation lines (a line starting with space/tab continues the prev).
  const raw = ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = raw.split(/\r?\n/);

  const events: ParsedVEvent[] = [];
  let inEvent = false;
  let inAlarm = false;
  let cur: Partial<ParsedVEvent> & { _alerts?: number[] } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = { alerts: [], _alerts: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur.start && cur.end) {
        events.push({
          summary: cur.summary || "Untitled event",
          start: cur.start,
          end: cur.end,
          allDay: cur.allDay ?? false,
          location: cur.location,
          description: cur.description,
          alerts: cur._alerts ?? [],
          recurrence: cur.recurrence,
        });
      }
      cur = {};
      continue;
    }
    if (line === "BEGIN:VALARM") {
      inAlarm = true;
      continue;
    }
    if (line === "END:VALARM") {
      inAlarm = false;
      continue;
    }
    if (!inEvent) continue;

    const { name, params, value } = splitProp(line);

    if (inAlarm) {
      if (name === "TRIGGER") {
        const m = /-PT(\d+)M/i.exec(value);
        if (m) cur._alerts!.push(-Number(m[1]));
        else if (/^P-?T(\d+)H/i.exec(value)) {
          const h = /(\d+)H/.exec(value);
          if (h) cur._alerts!.push(-Number(h[1]) * 60);
        }
      }
      continue;
    }

    switch (name) {
      case "SUMMARY":
        cur.summary = unescape(value);
        break;
      case "LOCATION":
        cur.location = unescape(value);
        break;
      case "DESCRIPTION":
        cur.description = unescape(value);
        break;
      case "DTSTART":
        cur.start = parseDate(value, params.VALUE === "DATE");
        cur.allDay = params.VALUE === "DATE";
        break;
      case "DTEND": {
        const allDay = params.VALUE === "DATE";
        let d = parseDate(value, allDay);
        // all-day DTEND is exclusive; back off one day so the event spans correctly
        if (allDay) {
          d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
        }
        cur.end = d;
        break;
      }
      case "RRULE":
        cur.recurrence = parseRrule(value);
        break;
    }
  }

  return events;
}

function splitProp(line: string): {
  name: string;
  params: Record<string, string>;
  value: string;
} {
  const colon = line.indexOf(":");
  if (colon === -1) return { name: "", params: {}, value: "" };
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf("=");
    if (eq > -1) {
      params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
    }
  }
  return { name, params, value };
}

function parseDate(value: string, allDay: boolean): Date {
  const v = value.trim();
  // YYYYMMDD or YYYYMMDDTHHMMSSZ or with TZID handled as UTC fallback
  if (allDay || v.length === 8) {
    const y = +v.slice(0, 4);
    const m = +v.slice(4, 6) - 1;
    const d = +v.slice(6, 8);
    return new Date(Date.UTC(y, m, d));
  }
  // strip trailing Z
  const z = v.endsWith("Z") ? v.slice(0, -1) : v;
  const y = +z.slice(0, 4);
  const m = +z.slice(4, 6) - 1;
  const d = +z.slice(6, 8);
  const hh = +z.slice(9, 11) || 0;
  const mm = +z.slice(11, 13) || 0;
  const ss = +z.slice(13, 15) || 0;
  return new Date(Date.UTC(y, m, d, hh, mm, ss));
}

function parseRrule(value: string): RecurrenceRule | undefined {
  const parts = value.split(";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > -1) map[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  const freq = (map.FREQ || "").toLowerCase();
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly" && freq !== "yearly") {
    return undefined;
  }
  const rule: RecurrenceRule = {
    freq,
    interval: map.INTERVAL ? Math.max(1, Number(map.INTERVAL)) : 1,
  };
  if (map.UNTIL) rule.until = parseDate(map.UNTIL, map.UNTIL.length === 8).toISOString();
  if (map.BYDAY) {
    const dayMap: Record<string, number> = {
      SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
    };
    rule.daysOfWeek = map.BYDAY.split(",")
      .map((d) => dayMap[d.slice(-2)])
      .filter((d) => d !== undefined);
  }
  return rule;
}

function unescape(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

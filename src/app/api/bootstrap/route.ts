import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SEED_ENTRIES,
  metaForTitle,
  resolveSeedTimes,
} from "@/lib/scheduler/seed";
import { startOfWeek } from "@/lib/scheduler/time";

// GET /api/bootstrap — idempotently ensure default calendars + starter schedule
// exist. Called on first page load so the calendar is never empty.
export async function GET() {
  const defaultCals = [
    { name: "Study", color: "#F59E0B", kind: "study" },
    { name: "Sport", color: "#10B981", kind: "sport" },
    { name: "Work", color: "#EF4444", kind: "work" },
    { name: "Home", color: "#06B6D4", kind: "home" },
    { name: "Social", color: "#22C55E", kind: "social" },
    { name: "Personal", color: "#A855F7", kind: "personal" },
  ];

  let calendars = await db.calendar.findMany();
  const calByKind: Record<string, string> = {};
  for (const c of calendars) calByKind[c.kind] = c.id;

  for (const c of defaultCals) {
    if (!calByKind[c.kind]) {
      const created = await db.calendar.create({ data: c });
      calByKind[created.kind] = created.id;
      calendars.push(created);
    }
  }

  const eventCount = await db.event.count();

  // If no events, seed the 2-week starter schedule anchored to this week's Monday.
  if (eventCount === 0) {
    const weekStart = startOfWeek(new Date().toISOString());
    const weekStartMs = new Date(weekStart).getTime();
    let seeded = 0;
    for (const entry of SEED_ENTRIES) {
      const meta = metaForTitle(entry.title);
      const { start, end } = resolveSeedTimes(entry, weekStartMs);
      await db.event.create({
        data: {
          title: entry.title,
          start,
          end,
          allDay: false,
          location: entry.location ?? null,
          calendarId: calByKind[meta.calendarKind] ?? calByKind["personal"],
          category: meta.category,
          flexibility: meta.flexibility,
          locationType: meta.locationType,
          minChunkMins: meta.minChunkMins,
          allowOverlap: meta.allowOverlap,
          priority: 0,
          travelMins: 0,
          color: null,
          alerts: JSON.stringify([-30, -10, 0]),
          recurrence: null,
        },
      });
      seeded++;
    }
    return NextResponse.json({
      calendars,
      weekStart,
      seeded,
      bootstrapped: true,
    });
  }

  return NextResponse.json({
    calendars,
    bootstrapped: false,
    eventCount,
  });
}

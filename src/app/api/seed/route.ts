import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  SEED_ENTRIES,
  SEED_SEMESTER_END,
  metaForTitle,
  recurrenceForSeed,
  resolveSeedTimes,
} from "@/lib/scheduler/seed";
import { startOfWeek } from "@/lib/scheduler/time";

// POST /api/seed  — wipe & reseed the default weekly-recurring course
// schedule. Called from the toolbar's "Reset to sample schedule" action.
export async function POST() {
  // Default calendars — derived from the category colour palette so each
  // kind renders distinctly.
  const defaultCals = [
    { name: "Study", color: "#F59E0B", kind: "study" },
    { name: "Sport", color: "#10B981", kind: "sport" },
    { name: "Work", color: "#EF4444", kind: "work" },
    { name: "Home", color: "#06B6D4", kind: "home" },
    { name: "Social", color: "#22C55E", kind: "social" },
    { name: "Personal", color: "#A855F7", kind: "personal" },
  ];

  await db.event.deleteMany();
  await db.calendar.deleteMany();
  // Also clear SentAlert so stale dedup records don't block re-seeded alerts.
  await db.sentAlert.deleteMany().catch(() => null);

  const calByKind: Record<string, string> = {};
  for (const c of defaultCals) {
    const created = await db.calendar.create({ data: c });
    calByKind[created.kind] = created.id;
  }

  // Anchor to Monday of the current week (local time) so courses appear now.
  const weekStartIso = startOfWeek(new Date().toISOString());
  const weekStartMonday = new Date(weekStartIso);

  let created = 0;
  for (const entry of SEED_ENTRIES) {
    const meta = metaForTitle(entry.title);
    const { start, end } = resolveSeedTimes(entry, weekStartMonday);
    const recurrence = recurrenceForSeed(entry);

    await db.event.create({
      data: {
        title: entry.title,
        start,
        end,
        allDay: false,
        location: entry.location ?? null,
        notes: entry.notes ?? null,
        calendarId: calByKind[meta.calendarKind] ?? calByKind["personal"],
        category: meta.category,
        flexibility: meta.flexibility,
        locationType: meta.locationType,
        minChunkMins: meta.minChunkMins,
        allowOverlap: meta.allowOverlap,
        priority: 0,
        travelMins: 0,
        color: null,
        alerts: JSON.stringify(entry.alerts ?? [-30, -10, 0]),
        recurrence: recurrence ? JSON.stringify(recurrence) : null,
      },
    });
    created++;
  }

  return NextResponse.json({
    ok: true,
    seeded: created,
    weekStart: weekStartIso,
    semesterEnd: SEED_SEMESTER_END,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/events/bulk
// Body: { updates: [{ id, start, end }], deleteIds?: string[] }
// Applies multiple time updates + optional deletions in one round-trip (used
// by the Undo feature). Returns counts.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    updates: { id: string; start: string; end: string }[];
    deleteIds?: string[];
  };

  let updated = 0;
  let deleted = 0;

  for (const u of body.updates ?? []) {
    try {
      await db.event.update({
        where: { id: u.id },
        data: { start: new Date(u.start), end: new Date(u.end) },
      });
      updated++;
    } catch {
      // event may have been deleted already; skip
    }
  }

  for (const id of body.deleteIds ?? []) {
    try {
      await db.event.delete({ where: { id } });
      deleted++;
    } catch {
      // already gone; skip
    }
  }

  return NextResponse.json({ ok: true, updated, deleted });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventToDomain } from "@/lib/mappers";

// GET /api/events/search?q=...&limit=...
// Full-text-ish LIKE search over event titles. Returns the most recent matches.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    50,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 30))
  );

  if (q.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // SQLite LIKE is case-insensitive for ASCII; for broader coverage also try
  // title = q exactly. We sort upcoming-first so the most relevant soon events
  // surface at the top.
  const rows = await db.event.findMany({
    where: { title: { contains: q } },
    orderBy: { start: "asc" },
    take: limit,
  });

  const events = rows.map(eventToDomain);
  return NextResponse.json({ events });
}

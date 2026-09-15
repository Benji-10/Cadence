import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarToDomain } from "@/lib/mappers";

// GET /api/calendars
export async function GET() {
  const calendars = await db.calendar.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ calendars: calendars.map(calendarToDomain) });
}

// POST /api/calendars  { name, color, kind }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    color: string;
    kind?: string;
  };
  const created = await db.calendar.create({
    data: {
      name: body.name,
      color: body.color,
      kind: body.kind ?? "personal",
    },
  });
  return NextResponse.json({ calendar: calendarToDomain(created) }, { status: 201 });
}

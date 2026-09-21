"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/lib/types";
import { eventColor } from "@/lib/calendar-ui";
import { cn } from "@/lib/utils";

interface MiniCalendarProps {
  selected: Date;
  events: CalendarEvent[];
  onSelectDay: (day: Date) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// A compact month grid for the sidebar. Days with events get a small dot
// (colored by the most-recent event's calendar); the selected day is
// ringed; today is filled. Clicking a day selects it.
export function MiniCalendar({ selected, events, onSelectDay }: MiniCalendarProps) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(selected));

  // Bucket events by yyyy-MM-dd for fast dot lookup.
  const daysWithEvents = useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) {
      const start = parseISO(ev.start);
      s.add(format(start, "yyyy-MM-dd"));
    }
    return s;
  }, [events]);

  const grid = useMemo(() => {
    const ms = startOfMonth(cursor);
    const me = endOfMonth(cursor);
    return eachDayOfInterval({
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    });
  }, [cursor]);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">
          {format(cursor, "MMMM yyyy")}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="py-1 text-center text-[10px] font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {grid.map((d) => {
          const inMonth = isSameMonth(d, cursor);
          const isToday_ = isToday(d);
          const isSelected = isSameDay(d, selected);
          const hasEvents = daysWithEvents.has(format(d, "yyyy-MM-dd"));
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDay(d)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && "text-foreground hover:bg-accent",
                isToday_ && "font-semibold",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {format(d, "d")}
              {hasEvents && !isSelected && (
                <span
                  className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-500"
                  aria-hidden
                />
              )}
              {hasEvents && isSelected && (
                <span
                  className="absolute bottom-0.5 h-1 w-1 rounded-full bg-white/80"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

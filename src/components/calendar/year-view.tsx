"use client";

import { useMemo } from "react";
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
import { cn } from "@/lib/utils";

interface YearViewProps {
  yearDate: Date; // any date within the target year
  events: CalendarEvent[];
  onSelectMonth: (monthDate: Date) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A 12-mini-month grid for the year. Each mini-month shows day numbers with
// dots on days that have events. Clicking a month drills into Month view.
export function YearView({ yearDate, events, onSelectMonth }: YearViewProps) {
  const year = yearDate.getFullYear();

  // Bucket events by yyyy-MM-dd for fast dot lookup across all 12 months.
  const daysWithEvents = useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) {
      s.add(format(parseISO(ev.start), "yyyy-MM-dd"));
    }
    return s;
  }, [events]);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const monthDate = new Date(year, i, 1);
        const ms = startOfMonth(monthDate);
        const me = endOfMonth(monthDate);
        const grid = eachDayOfInterval({
          start: startOfWeek(ms, { weekStartsOn: 1 }),
          end: endOfWeek(me, { weekStartsOn: 1 }),
        });
        return { monthDate, grid };
      }),
    [year]
  );

  return (
    <div className="cal-scroll h-full overflow-auto">
      <div className="mx-auto max-w-4xl p-3 sm:p-6">
        {/* Year header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold sm:text-2xl">{year}</h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onSelectMonth(subMonths(new Date(year, 0, 1), 1))}
              aria-label="Previous year"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onSelectMonth(addMonths(new Date(year, 0, 1), 1))}
              aria-label="Next year"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* 12 mini-months in a responsive grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {months.map(({ monthDate, grid }) => (
            <button
              key={monthDate.toISOString()}
              onClick={() => onSelectMonth(monthDate)}
              className="group rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-emerald-500/50 hover:shadow-md"
            >
              <div className="mb-2 text-center text-sm font-semibold">
                {MONTH_NAMES[monthDate.getMonth()]}
              </div>
              {/* Weekday header */}
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
                  <div
                    key={i}
                    className="text-center text-[8px] font-medium text-muted-foreground"
                  >
                    {w}
                  </div>
                ))}
              </div>
              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {grid.map((d) => {
                  const inMonth = isSameMonth(d, monthDate);
                  const today_ = isToday(d);
                  const hasEvents = daysWithEvents.has(format(d, "yyyy-MM-dd"));
                  return (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded text-[10px]",
                        !inMonth && "text-muted-foreground/30",
                        inMonth && "text-foreground",
                        today_ && "bg-primary font-bold text-primary-foreground"
                      )}
                    >
                      {format(d, "d")}
                      {hasEvents && !today_ && (
                        <span className="absolute bottom-0.5 size-1 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

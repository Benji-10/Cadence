"use client";

import { useMemo } from "react";
import {
  addDays,
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
} from "date-fns";
import { Lock } from "lucide-react";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { eventColor } from "@/lib/calendar-ui";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  monthDate: Date; // any date within the target month
  events: CalendarEvent[];
  calendarsById: Record<string, Calendar | undefined>;
  hiddenCalendarIds: Set<string>;
  onSelect?: (event: CalendarEvent) => void;
  onCreate?: (defaults: { start: string; end: string; calendarId?: string }) => void;
  onPickDay?: (day: Date) => void;
  defaultCalendarId?: string;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({
  monthDate,
  events,
  calendarsById,
  hiddenCalendarIds,
  onSelect,
  onCreate,
  onPickDay,
  defaultCalendarId,
}: MonthViewProps) {
  const { gridDays, eventsByDay } = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const byDay = new Map<string, CalendarEvent[]>();
    for (const d of days) byDay.set(format(d, "yyyy-MM-dd"), []);

    for (const ev of events) {
      if (hiddenCalendarIds.has(ev.calendarId)) continue;
      const start = parseISO(ev.start);
      // An event that spans multiple days appears on each day it covers.
      const end = parseISO(ev.end);
      for (const d of days) {
        if (
          (start <= d && d <= end) ||
          isSameDay(start, d) ||
          isSameDay(end, d)
        ) {
          // crude but fine for the month overview
          if (start <= d && d < end) {
            byDay.get(format(d, "yyyy-MM-dd"))?.push(ev);
          } else if (isSameDay(start, d)) {
            byDay.get(format(d, "yyyy-MM-dd"))?.push(ev);
          }
        }
      }
    }
    return { gridDays: days, eventsByDay: byDay };
  }, [monthDate, events, hiddenCalendarIds]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-background/95 glass">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="cal-scroll grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-auto">
        {gridDays.map((day, i) => {
          const inMonth = isSameMonth(day, monthDate);
          const today_ = isToday(day);
          const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const shown = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - shown.length;

          return (
            <div
              key={day.toISOString()}
              onClick={() => {
                if (onPickDay) onPickDay(day);
              }}
              className={cn(
                "group relative flex min-h-[84px] cursor-pointer flex-col gap-0.5 border-b border-r border-border p-1 transition-colors",
                !inMonth && "bg-muted/30 text-muted-foreground",
                inMonth && isWeekend && "bg-muted/20",
                today_ && "ring-1 ring-inset ring-emerald-500/40",
                "hover:bg-accent/40"
              )}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" && onPickDay) onPickDay(day);
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    today_
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground/70"
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {shown.map((ev) => {
                  const color = eventColor(ev, calendarsById);
                  const fixed = ev.flexibility === "fixed";
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect?.(ev);
                      }}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight transition-colors",
                        "hover:brightness-95"
                      )}
                      style={{ backgroundColor: color + "22", color }}
                      title={`${ev.title} · ${format(parseISO(ev.start), "HH:mm")}`}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{ev.title}</span>
                      {fixed && <Lock className="size-2.5 shrink-0 opacity-70" />}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <span className="pl-1 text-[9px] font-medium text-muted-foreground">
                    +{overflow} more
                  </span>
                )}
                {inMonth && dayEvents.length === 0 && (
                  <span className="px-1 text-[9px] text-muted-foreground/0 group-hover:text-muted-foreground/50">
                    +
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { addDays, format, isSameDay, parseISO } from "date-fns";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { DayColumn } from "./day-column";
import { TimeAxis } from "./time-axis";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  weekStart: Date; // local Monday midnight
  events: CalendarEvent[];
  calendarsById: Record<string, Calendar | undefined>;
  hiddenCalendarIds: Set<string>;
  selectedEventId?: string;
  onSelect?: (event: CalendarEvent) => void;
  onCreate?: (defaults: { start: string; end: string; calendarId?: string }) => void;
  onMoveEvent?: (
    event: CalendarEvent,
    newStart: string,
    newEnd: string
  ) => void;
  onResizeEvent?: (
    event: CalendarEvent,
    newStart: string,
    newEnd: string
  ) => void;
  onBlockedMove?: (event: CalendarEvent) => void;
  defaultCalendarId?: string;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function WeekView({
  weekStart,
  events,
  calendarsById,
  hiddenCalendarIds,
  selectedEventId,
  onSelect,
  onCreate,
  onMoveEvent,
  onResizeEvent,
  onBlockedMove,
  defaultCalendarId,
  scrollContainerRef,
}: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  // Group events by day. An event belongs to a day if it starts on that day.
  // (Events that cross midnight may render in their start day only — same as
  // the iOS calendar's day view.)
  const eventsByDay = useMemo_eventsByDay(events, days);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day header row */}
      <div className="flex border-b border-border bg-background/95 glass">
        <div className="w-14 shrink-0 border-r border-border" />
        <div className="grid flex-1 grid-cols-7">
          {days.map((d) => {
            const today_ = isSameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className="flex flex-col items-center justify-center py-2"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {format(d, "EEE")}
                </span>
                <span
                  className={cn(
                    "mt-1 flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                    today_
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {format(d, "d")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable grid */}
      <div
        ref={scrollContainerRef}
        className="cal-scroll min-h-0 flex-1 overflow-auto"
        style={{ overscrollBehaviorY: "none" }}
      >
        <div className="flex min-w-max">
          <TimeAxis />
          <div className="grid flex-1 grid-cols-7">
            {days.map((d, i) => {
              const dayEvents = eventsByDay[i] ?? [];
              const visible = dayEvents.filter(
                (e) => !hiddenCalendarIds.has(e.calendarId)
              );
              return (
                <DayColumn
                  key={d.toISOString()}
                  day={d}
                  events={visible}
                  calendarsById={calendarsById}
                  selectedEventId={selectedEventId}
                  isToday={isSameDay(d, today)}
                  onSelect={onSelect}
                  onCreate={onCreate}
                  onMoveEvent={onMoveEvent}
                  onResizeEvent={onResizeEvent}
                  onBlockedMove={onBlockedMove}
                  defaultCalendarId={defaultCalendarId}
                />
              );
            })}
          </div>
        </div>
        {/* Bottom spacer so the last hour row isn't flush against the footer */}
        <div style={{ height: HOUR_HEIGHT * 2 }} />
      </div>
    </div>
  );
}

// Hoist the events-by-day grouping into a tiny custom hook so we can keep the
// component body readable. Memoized on the events array reference.
function useMemo_eventsByDay(events: CalendarEvent[], days: Date[]) {
  // Use Map keyed by day-ISO for O(n) grouping.
  const buckets = new Map<number, CalendarEvent[]>();
  for (let i = 0; i < days.length; i++) buckets.set(i, []);
  for (const ev of events) {
    const start = parseISO(ev.start);
    for (let i = 0; i < days.length; i++) {
      if (isSameDay(start, days[i])) {
        buckets.get(i)!.push(ev);
        break;
      }
    }
  }
  return Array.from(buckets.values());
}

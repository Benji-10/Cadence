"use client";

import { useMemo, useRef } from "react";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { DayColumn } from "./day-column";
import { TimeAxis } from "./time-axis";
import { HOUR_HEIGHT, snapMins } from "@/lib/calendar-ui";
import { useEventDrag } from "@/hooks/use-event-drag";
import { useSettings } from "@/lib/settings-store";
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
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();
  const columnsRef = useRef<HTMLDivElement | null>(null);

  // Shared drag instance lifted to the week level so the pointer's X can
  // determine the target day (cross-day drag). The resolver maps client
  // coordinates → a concrete start/end datetime within the 7-day grid.
  const snapSetting = useSettings((s) => s.snapMins);
  const drag = useEventDrag({
    onMove: (event, newStart, newEnd) => onMoveEvent?.(event, newStart, newEnd),
    onBlocked: (event) => onBlockedMove?.(event),
    snapMins: snapSetting,
    resolveNewTimes: (event, clientX, _originY, clientY) => {
      const el = columnsRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const colWidth = rect.width / 7;
      let colIdx = Math.floor((clientX - rect.left) / colWidth);
      colIdx = Math.max(0, Math.min(6, colIdx));
      const yInCol = clientY - rect.top;
      let mins = snapMins((yInCol / HOUR_HEIGHT) * 60, snapSetting);
      mins = Math.max(0, Math.min(23 * 60 + 45, mins));
      const targetDay = days[colIdx];
      const start = new Date(targetDay);
      start.setHours(0, 0, 0, 0);
      start.setMinutes(mins);
      const durMs = parseISO(event.end).getTime() - parseISO(event.start).getTime();
      const end = new Date(start.getTime() + durMs);
      return { newStart: start.toISOString(), newEnd: end.toISOString() };
    },
  });

  // Group events by day. An event belongs to a day if it starts on that day.
  // All-day events are excluded here (they render in the all-day strip).
  const eventsByDay = useMemo(() => {
    const buckets: CalendarEvent[][] = Array.from({ length: 7 }, () => []);
    for (const ev of events) {
      if (ev.allDay) continue;
      const start = parseISO(ev.start);
      for (let i = 0; i < days.length; i++) {
        if (isSameDay(start, days[i])) {
          buckets[i].push(ev);
          break;
        }
      }
    }
    return buckets;
  }, [events, days]);

  // All-day events per day (shown in a dedicated strip below the day header,
  // mirroring iOS Calendar). An all-day event appears on every day it spans
  // within this week.
  const allDayByDay = useMemo(() => {
    const buckets: CalendarEvent[][] = Array.from({ length: 7 }, () => []);
    for (const ev of events) {
      if (!ev.allDay) continue;
      if (hiddenCalendarIds.has(ev.calendarId)) continue;
      const s = parseISO(ev.start).getTime();
      const e = parseISO(ev.end).getTime();
      for (let i = 0; i < days.length; i++) {
        const dayStartMs = days[i].getTime();
        const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
        // event covers this day if it starts before the day ends AND ends
        // after the day starts (standard interval overlap).
        if (s < dayEndMs && e > dayStartMs) {
          buckets[i].push(ev);
        }
      }
    }
    return buckets;
  }, [events, days, hiddenCalendarIds]);

  const hasAllDay = allDayByDay.some((b) => b.length > 0);

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
                    "mt-1 flex size-7 items-center justify-center rounded-full text-sm font-semibold transition-colors",
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

      {/* All-day events strip */}
      {hasAllDay && (
        <div className="flex border-b border-border bg-muted/20">
          <div className="flex w-14 shrink-0 items-center justify-end border-r border-border px-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              all-day
            </span>
          </div>
          <div className="grid flex-1 grid-cols-7">
            {days.map((d, i) => {
              const dayAllDay = allDayByDay[i] ?? [];
              return (
                <div
                  key={`allday-${d.toISOString()}`}
                  className="flex min-h-[28px] flex-col gap-0.5 border-r border-border p-1 last:border-r-0"
                >
                  {dayAllDay.slice(0, 2).map((ev) => {
                    const cal = calendarsById[ev.calendarId];
                    const color = ev.color ?? cal?.color ?? "#64748B";
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelect?.(ev)}
                        className="truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight text-white transition-filter hover:brightness-110"
                        style={{ backgroundColor: color }}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    );
                  })}
                  {dayAllDay.length > 2 && (
                    <span className="px-1 text-[9px] text-muted-foreground">
                      +{dayAllDay.length - 2} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable grid */}
      <div
        ref={scrollContainerRef}
        className="cal-scroll min-h-0 flex-1 overflow-auto"
        style={{ overscrollBehaviorY: "none" }}
      >
        <div className="flex min-w-max">
          <TimeAxis />
          <div ref={columnsRef} className="grid flex-1 grid-cols-7">
            {days.map((d, i) => {
              const dayEvents = (eventsByDay[i] ?? []).filter(
                (e) => !hiddenCalendarIds.has(e.calendarId)
              );
              return (
                <DayColumn
                  key={d.toISOString()}
                  day={d}
                  events={dayEvents}
                  calendarsById={calendarsById}
                  selectedEventId={selectedEventId}
                  isToday={isSameDay(d, today)}
                  onSelect={onSelect}
                  onCreate={onCreate}
                  onMoveEvent={onMoveEvent}
                  onResizeEvent={onResizeEvent}
                  onBlockedMove={onBlockedMove}
                  defaultCalendarId={defaultCalendarId}
                  sharedDrag={drag}
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

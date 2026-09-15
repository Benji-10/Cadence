"use client";

import { format, isSameDay, parseISO } from "date-fns";
import { useMemo } from "react";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { DayColumn } from "./day-column";
import { TimeAxis } from "./time-axis";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";
import { cn } from "@/lib/utils";

interface DayViewProps {
  day: Date; // local midnight
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
  onPrevDay?: () => void;
  onNextDay?: () => void;
}

export function DayView({
  day,
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
  onPrevDay,
  onNextDay,
}: DayViewProps) {
  const today = new Date();
  const allDayEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.allDay &&
          !hiddenCalendarIds.has(e.calendarId) &&
          parseISO(e.start).getTime() < day.getTime() + 24 * 60 * 60 * 1000 &&
          parseISO(e.end).getTime() > day.getTime()
      ),
    [events, day, hiddenCalendarIds]
  );
  // Multi-day timed events that started on a PREVIOUS day and continue onto
  // this day (shown in a "continues from yesterday" header strip).
  const continuations = useMemo(
    () =>
      events.filter((e) => {
        if (e.allDay) return false;
        if (hiddenCalendarIds.has(e.calendarId)) return false;
        const s = parseISO(e.start);
        const e2 = parseISO(e.end);
        if (isSameDay(s, e2)) return false; // single-day
        const dayStartMs = day.getTime();
        const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
        // spans this day AND started before this day
        return s.getTime() < dayEndMs && e2.getTime() > dayStartMs && !isSameDay(s, day);
      }),
    [events, day, hiddenCalendarIds]
  );
  const dayEvents = events.filter(
    (e) =>
      !e.allDay &&
      isSameDay(parseISO(e.start), day) &&
      !hiddenCalendarIds.has(e.calendarId)
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Day header */}
      <div className="flex border-b border-border bg-background/95 glass">
        <div className="w-14 shrink-0 border-r border-border" />
        <div className="flex flex-1 items-center justify-between px-4 py-2">
          {onPrevDay ? (
            <button
              aria-label="Previous day"
              onClick={onPrevDay}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              ‹
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {format(day, "EEEE")}
            </span>
            <span
              className={cn(
                "text-base font-semibold",
                isSameDay(day, today) && "text-primary"
              )}
            >
              {format(day, "d MMMM yyyy")}
            </span>
          </div>
          {onNextDay ? (
            <button
              aria-label="Next day"
              onClick={onNextDay}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              ›
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      {/* All-day strip */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-border bg-muted/20">
          <div className="flex w-14 shrink-0 items-center justify-end border-r border-border px-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              all-day
            </span>
          </div>
          <div className="flex flex-1 flex-wrap gap-1 p-1">
            {allDayEvents.map((ev) => {
              const cal = calendarsById[ev.calendarId];
              const color = ev.color ?? cal?.color ?? "#64748B";
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelect?.(ev)}
                  className="truncate rounded px-2 py-0.5 text-left text-[11px] font-medium text-white transition-filter hover:brightness-110"
                  style={{ backgroundColor: color }}
                >
                  {ev.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Continues-from-yesterday strip (multi-day timed events) */}
      {continuations.length > 0 && (
        <div className="flex border-b border-border bg-muted/20">
          <div className="flex w-14 shrink-0 items-center justify-end border-r border-border px-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              cont.
            </span>
          </div>
          <div className="flex flex-1 flex-wrap gap-1 p-1">
            {continuations.map((ev) => {
              const cal = calendarsById[ev.calendarId];
              const color = ev.color ?? cal?.color ?? "#64748B";
              const start = parseISO(ev.start);
              const end = parseISO(ev.end);
              const endsHere = isSameDay(end, day);
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelect?.(ev)}
                  className="flex items-center gap-1.5 truncate rounded px-2 py-0.5 text-left text-[11px] font-medium text-white transition-filter hover:brightness-110"
                  style={{ backgroundColor: color }}
                  title={`${ev.title} — started ${format(start, "EEE d MMM, HH:mm")}${endsHere ? `, ends ${format(end, "HH:mm")}` : ""}`}
                >
                  <span className="opacity-80">↳</span>
                  <span className="truncate">{ev.title}</span>
                  <span className="opacity-70">
                    from {format(start, "EEE HH:mm")}
                  </span>
                  {endsHere && (
                    <span className="opacity-90">→ {format(end, "HH:mm")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="cal-scroll min-h-0 flex-1 overflow-auto"
        style={{ overscrollBehaviorY: "none" }}
      >
        <div className="flex min-w-max">
          <TimeAxis />
          <div className="flex-1">
            <DayColumn
              day={day}
              events={dayEvents}
              calendarsById={calendarsById}
              selectedEventId={selectedEventId}
              isToday={isSameDay(day, today)}
              onSelect={onSelect}
              onCreate={onCreate}
              onMoveEvent={onMoveEvent}
              onResizeEvent={onResizeEvent}
              onBlockedMove={onBlockedMove}
              defaultCalendarId={defaultCalendarId}
              compact
            />
          </div>
        </div>
        <div style={{ height: HOUR_HEIGHT * 2 }} />
      </div>
    </div>
  );
}

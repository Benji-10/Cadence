"use client";

import { format, isSameDay, parseISO } from "date-fns";
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
  const dayEvents = events.filter(
    (e) => isSameDay(parseISO(e.start), day) && !hiddenCalendarIds.has(e.calendarId)
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

"use client";

import { useMemo } from "react";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { HOUR_HEIGHT, layoutEvents, snapMins } from "@/lib/calendar-ui";
import { EventBlock } from "./event-block";
import { NowLine } from "./now-line";
import { useEventDrag } from "@/hooks/use-event-drag";
import { useEventResize } from "@/hooks/use-event-resize";
import { cn } from "@/lib/utils";

interface DayColumnProps {
  day: Date; // local midnight of this day
  events: CalendarEvent[]; // already filtered to this day
  calendarsById: Record<string, Calendar | undefined>;
  selectedEventId?: string;
  isToday?: boolean;
  compact?: boolean;
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
}

export function DayColumn({
  day,
  events,
  calendarsById,
  selectedEventId,
  isToday,
  compact,
  onSelect,
  onCreate,
  onMoveEvent,
  onResizeEvent,
  onBlockedMove,
  defaultCalendarId,
}: DayColumnProps) {
  const positioned = useMemo(() => layoutEvents(events), [events]);

  const drag = useEventDrag({
    onMove: (event, newStart, newEnd) => onMoveEvent?.(event, newStart, newEnd),
    onBlocked: (event) => onBlockedMove?.(event),
  });

  const resize = useEventResize({
    onResize: (event, newStart, newEnd) =>
      onResizeEvent?.(event, newStart, newEnd),
  });

  const dayStartMs = day.getTime();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.didDragRef.current) return;
    if (!onCreate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = Math.max(0, Math.min(23 * 60 + 45, snapMins((y / HOUR_HEIGHT) * 60)));
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    start.setMinutes(mins);
    const end = new Date(start.getTime() + 60 * 60_000);
    onCreate({
      start: start.toISOString(),
      end: end.toISOString(),
      calendarId: defaultCalendarId,
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      className={cn(
        "relative flex-1 border-r border-border last:border-r-0",
        isToday && "bg-accent/30"
      )}
      style={{ height: 24 * HOUR_HEIGHT }}
      onPointerDown={() => {
        // Reset the "did drag" flag on every new interaction so the click
        // handler knows whether to open the editor or treat this as a drag.
        drag.resetDrag();
      }}
      onClick={handleClick}
    >
      {/* Hour grid lines */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: h * HOUR_HEIGHT }}
        />
      ))}
      {/* Half-hour lines (subtler) */}
      {hours.map((h) => (
        <div
          key={`half-${h}`}
          className="absolute inset-x-0 border-t border-border/25"
          style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
        />
      ))}

      {/* Events */}
      {positioned.map(({ event, lane, lanesInCluster }) => (
        <EventBlock
          key={event.id}
          event={event}
          lane={lane}
          lanesInCluster={lanesInCluster}
          calendarsById={calendarsById}
          selected={selectedEventId === event.id}
          dragPreview={drag.drag}
          resizePreview={resize.resize}
          didDragRef={drag.didDragRef}
          onPointerDown={drag.onPointerDown}
          onHandlePointerDown={
            event.flexibility !== "fixed" ? resize.onHandlePointerDown : undefined
          }
          onSelect={onSelect}
        />
      ))}

      {/* Now line */}
      <NowLine dayStartMs={dayStartMs} />

      {/* Compact-mode hint for empty columns */}
      {compact && events.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-[10px] text-muted-foreground/60">
          Tap to add
        </div>
      )}
    </div>
  );
}

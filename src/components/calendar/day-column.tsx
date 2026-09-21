"use client";

import { useMemo, useRef, useEffect } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { HOUR_HEIGHT, layoutEvents, snapMins as snapMinsFn, conflictingEventIds } from "@/lib/calendar-ui";
import { EventBlock } from "./event-block";
import { NowLine } from "./now-line";
import { useEventDrag } from "@/hooks/use-event-drag";
import { useEventResize } from "@/hooks/use-event-resize";
import { useCreateDrag } from "@/hooks/use-create-drag";
import { useSettings } from "@/lib/settings-store";
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
  sharedDrag?: ReturnType<typeof useEventDrag>;
  continuations?: CalendarEvent[];
  onLongPress?: (event: CalendarEvent) => void;
  hourHeight?: number;
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
  sharedDrag,
  continuations,
  onLongPress,
  hourHeight,
}: DayColumnProps) {
  const HH = hourHeight ?? HOUR_HEIGHT;
  const positioned = useMemo(() => layoutEvents(events), [events]);
  const showConflicts = useSettings((s) => s.showConflictBadges);
  const conflictIds = useMemo(
    () => (showConflicts ? conflictingEventIds(events) : new Set<string>()),
    [events, showConflicts]
  );

  // Fall back to a local drag when no shared instance is supplied (DayView).
  // Reads the snap increment from the settings store.
  const snapMins = useSettings((s) => s.snapMins);
  const localDrag = useEventDrag({
    onMove: (event, newStart, newEnd) => onMoveEvent?.(event, newStart, newEnd),
    onBlocked: (event) => onBlockedMove?.(event),
    snapMins,
  });
  const drag = sharedDrag ?? localDrag;

  // When the drag interaction enters "active" mode via touch long-press,
  // fire the onLongPress callback so the parent can show quick actions.
  const { mode: _iMode, eventId: _iEventId, viaLongPress: _iViaLP } = drag.interaction;
  const prevMode = useRef(_iMode);
  useEffect(() => {
    if (_iMode === "active" && prevMode.current !== "active" && _iViaLP && _iEventId && onLongPress) {
      const ev = events.find((e) => e.id === _iEventId);
      if (ev) onLongPress(ev);
    }
    prevMode.current = _iMode;
  }, [_iMode, _iViaLP, _iEventId, events, onLongPress]);

  const resize = useEventResize({
    onResize: (event, newStart, newEnd) =>
      onResizeEvent?.(event, newStart, newEnd),
    snapMins,
  });

  // Drag-to-create in empty column space.
  const createDrag = useCreateDrag({
    onCreate: (d) => onCreate?.(d),
    rangeFromMins: (startMins, endMins) => {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      start.setMinutes(startMins);
      const end = new Date(day);
      end.setHours(0, 0, 0, 0);
      end.setMinutes(endMins);
      return { start: start.toISOString(), end: end.toISOString() };
    },
  });

  const dayStartMs = day.getTime();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.didDragRef.current) return;
    if (createDrag.consumeMoved()) return;
    // On touch, creation is handled by useCreateDrag's long-press, not click.
    if (e.detail === 0) return;
    if (!onCreate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = Math.max(0, Math.min(23 * 60 + 45, snapMinsFn((y / HH) * 60, snapMins)));
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

  const columnRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={columnRef}
      className={cn(
        "relative flex-1 border-r border-border last:border-r-0 select-none",
        isToday && "bg-accent/30"
      )}
      style={{
        height: 24 * HH,
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onPointerDown={(e) => {
        drag.resetDrag();
        // useCreateDrag handles the long-press timer + preview internally.
        createDrag.onPointerDown(e);
      }}
      onClick={handleClick}
    >
      {/* Hour grid lines */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: h * HH }}
        />
      ))}
      {/* Half-hour lines (subtler) */}
      {hours.map((h) => (
        <div
          key={`half-${h}`}
          className="absolute inset-x-0 border-t border-border/25"
          style={{ top: h * HH + HH / 2 }}
        />
      ))}

      {/* Drag-to-create preview */}
      {createDrag.preview && (
        <div
          className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed border-emerald-500/70 bg-emerald-500/15"
          style={{
            top: Math.min(createDrag.preview.startY, createDrag.preview.endY),
            height: Math.abs(createDrag.preview.endY - createDrag.preview.startY),
          }}
        />
      )}

      {/* Multi-day continuation bars (timed events spilling over from a previous day) */}
      {continuations && continuations.length > 0 && (
        <div className="absolute inset-x-0.5 top-1 z-[5] flex flex-col gap-0.5">
          {continuations.map((ev) => {
            const cal = calendarsById[ev.calendarId];
            const color = ev.color ?? cal?.color ?? "#64748B";
            const endsHere = isSameDay(parseISO(ev.end), day);
            const endTime = parseISO(ev.end);
            return (
              <button
                key={`cont-${ev.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(ev);
                }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white transition-filter hover:brightness-110"
                style={{ backgroundColor: color }}
                title={`${ev.title} (continues${endsHere ? ` until ${format(endTime, "HH:mm")}` : ""})`}
              >
                <span className="shrink-0 opacity-80">↳</span>
                <span className="truncate">
                  {ev.title}
                  {endsHere && (
                    <span className="ml-1 opacity-80">→ {format(endTime, "HH:mm")}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Events */}
      {positioned.map(({ event, lane, lanesInCluster }) => {
        // If this event is being dragged to a different day, render only a
        // faded placeholder at its original position (the live ghost renders
        // in the target column below).
        const isFlying =
          drag.drag?.eventId === event.id &&
          !isSameDay(parseISO(drag.drag.previewStart), day);
        if (isFlying) {
          return (
            <div
              key={event.id}
              className="pointer-events-none absolute inset-x-0 rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/20"
              style={{
                top: (event
                  ? (parseISO(event.start).getHours() * 60 +
                      parseISO(event.start).getMinutes()) / 60
                  : 0) * HH,
                height: Math.max(
                  22,
                  ((parseISO(event.end).getTime() -
                    parseISO(event.start).getTime()) /
                    60000 /
                    60) *
                    HH
                ),
                left: `calc(${lane * (100 / lanesInCluster)}% + 2px)`,
                width: `calc(${100 / lanesInCluster}% - 4px)`,
              }}
            />
          );
        }
        return (
          <EventBlock
            key={event.id}
            event={event}
            lane={lane}
            lanesInCluster={lanesInCluster}
            calendarsById={calendarsById}
            selected={selectedEventId === event.id}
            conflict={conflictIds.has(event.id)}
            isHovering={drag.interaction.mode === "active" && drag.interaction.eventId === event.id}
            dragPreview={drag.drag}
            resizePreview={resize.resize}
            didDragRef={drag.didDragRef}
            onPointerDown={drag.onPointerDown}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerLeave={drag.onPointerLeave}
            onHandlePointerDown={
              event.flexibility !== "fixed" ? resize.onHandlePointerDown : undefined
            }
            onSelect={onSelect}
            onLongPress={onLongPress}
          />
        );
      })}

      {/* Cross-day ghost: the dragged event landing on THIS column */}
      {drag.drag &&
        isSameDay(parseISO(drag.drag.previewStart), day) &&
        !events.some((e) => e.id === drag.drag!.eventId) && (
          <EventBlock
            event={drag.drag.event}
            lane={0}
            lanesInCluster={1}
            calendarsById={calendarsById}
            isGhost
            dragPreview={drag.drag}
          />
        )}

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

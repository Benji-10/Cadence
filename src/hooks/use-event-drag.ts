"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";

export interface DragPreview {
  eventId: string;
  event: CalendarEvent;
  previewStart: string;
  previewEnd: string;
}

export interface UseEventDragOptions {
  onMove: (event: CalendarEvent, newStart: string, newEnd: string) => void;
  onBlocked: (event: CalendarEvent) => void;
  // Snap increment in minutes (default 15).
  snapMins?: number;
  // Optional: given the current pointer position (clientX/clientY) and the
  // Y where the drag began, compute the new start/end datetimes. When
  // provided this enables cross-day dragging (the resolver can map clientX to
  // a day). When omitted, the drag falls back to vertical/time-only movement.
  resolveNewTimes?: (
    event: CalendarEvent,
    clientX: number,
    originClientY: number,
    currentClientY: number
  ) => { newStart: string; newEnd: string } | null;
}

// Pointer-event-based drag. Snaps to 15min. The dragged event's preview
// start/end are returned in `drag` so the day column can render a ghost at the
// new position. `didDragRef` is true between pointer-down and the next
// pointer-down if a drag (movement > threshold) actually occurred — used by the
// event block to suppress the click that follows a drag.
export function useEventDrag(opts: UseEventDragOptions) {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const [drag, setDrag] = useState<DragPreview | null>(null);
  const didDragRef = useRef(false);

  const resetDrag = useCallback(() => {
    didDragRef.current = false;
  }, []);

  const beginDrag = useCallback(
    (event: CalendarEvent, originX: number, originY: number) => {
      document.body.classList.add("dragging");
      didDragRef.current = false;

      const onMove = (e: PointerEvent) => {
        const deltaY = e.clientY - originY;
        const deltaX = e.clientX - originX;
        if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 8) didDragRef.current = true;

        let next: { newStart: string; newEnd: string } | null = null;
        if (optsRef.current.resolveNewTimes) {
          next = optsRef.current.resolveNewTimes(
            event,
            e.clientX,
            originY,
            e.clientY
          );
        }
        if (!next) {
          // Vertical/time-only fallback (same-day).
          const snap = optsRef.current.snapMins ?? 15;
          const deltaMins = Math.round((deltaY / HOUR_HEIGHT) * 60 / snap) * snap;
          const startMs = parseISO(event.start).getTime();
          const durMs = parseISO(event.end).getTime() - parseISO(event.start).getTime();
          const newStartMs = startMs + deltaMins * 60_000;
          next = {
            newStart: new Date(newStartMs).toISOString(),
            newEnd: new Date(newStartMs + durMs).toISOString(),
          };
        }
        setDrag({
          eventId: event.id,
          event,
          previewStart: next.newStart,
          previewEnd: next.newEnd,
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove("dragging");
        setDrag((current) => {
          if (current && current.previewStart !== event.start) {
            optsRef.current.onMove(
              event,
              current.previewStart,
              current.previewEnd
            );
          }
          return null;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    []
  );

  const onPointerDown = useCallback(
    (event: CalendarEvent, e: React.PointerEvent) => {
      if (event.flexibility === "fixed") {
        optsRef.current.onBlocked(event);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      beginDrag(event, e.clientX, e.clientY);
    },
    [beginDrag]
  );

  const cancel = useCallback(() => {
    setDrag(null);
    document.body.classList.remove("dragging");
  }, []);

  return { drag, onPointerDown, cancel, didDragRef, resetDrag };
}

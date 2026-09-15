"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";

export interface DragPreview {
  eventId: string;
  previewStart: string;
  previewEnd: string;
}

export interface UseEventDragOptions {
  onMove: (event: CalendarEvent, newStart: string, newEnd: string) => void;
  onBlocked: (event: CalendarEvent) => void;
}

// Pointer-event-based vertical drag. Snaps to 15min. The dragged event's
// preview start/end are returned in `drag` so the day column can render a
// ghost at the new position. `didDragRef` is true between pointer-down and
// the next pointer-down if a drag (movement > threshold) actually occurred —
// used by the event block to suppress the click that follows a drag.
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

  const beginDrag = useCallback((event: CalendarEvent, clientY: number) => {
    document.body.classList.add("dragging");
    didDragRef.current = false;

    const onMove = (e: PointerEvent) => {
      const deltaY = e.clientY - clientY;
      if (Math.abs(deltaY) > 5) didDragRef.current = true;
      const deltaMins = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
      const startMs = parseISO(event.start).getTime();
      const durMs = parseISO(event.end).getTime() - parseISO(event.start).getTime();
      const newStartMs = startMs + deltaMins * 60_000;
      const newStart = new Date(newStartMs).toISOString();
      const newEnd = new Date(newStartMs + durMs).toISOString();
      setDrag({ eventId: event.id, previewStart: newStart, previewEnd: newEnd });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("dragging");
      setDrag((current) => {
        if (current && current.previewStart !== event.start) {
          optsRef.current.onMove(event, current.previewStart, current.previewEnd);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const onPointerDown = useCallback(
    (event: CalendarEvent, e: React.PointerEvent) => {
      if (event.flexibility === "fixed") {
        optsRef.current.onBlocked(event);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      beginDrag(event, e.clientY);
    },
    [beginDrag]
  );

  const cancel = useCallback(() => {
    setDrag(null);
    document.body.classList.remove("dragging");
  }, []);

  return { drag, onPointerDown, cancel, didDragRef, resetDrag };
}

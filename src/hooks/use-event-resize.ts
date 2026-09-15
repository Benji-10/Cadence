"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseISO } from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";

export type ResizeHandle = "top" | "bottom";

export interface ResizePreview {
  eventId: string;
  previewStart: string;
  previewEnd: string;
}

export interface UseEventResizeOptions {
  onResize: (event: CalendarEvent, newStart: string, newEnd: string) => void;
  minMins?: number; // default 15
  snapMins?: number; // default 15
}

// Resize from top or bottom handle. Snaps to 15min. Enforces min duration.
export function useEventResize(opts: UseEventResizeOptions) {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const [resize, setResize] = useState<ResizePreview | null>(null);

  const begin = useCallback(
    (event: CalendarEvent, handle: ResizeHandle, clientY: number) => {
      document.body.classList.add("dragging");
      const minMins = optsRef.current.minMins ?? 15;

      const onMove = (e: PointerEvent) => {
        const deltaY = e.clientY - clientY;
        const snap = optsRef.current.snapMins ?? 15;
        const deltaMins = Math.round((deltaY / HOUR_HEIGHT) * 60 / snap) * snap;
        const startMs = parseISO(event.start).getTime();
        const endMs = parseISO(event.end).getTime();
        const minMs = minMins * 60_000;

        let newStartMs = startMs;
        let newEndMs = endMs;
        if (handle === "top") {
          newStartMs = Math.min(startMs + deltaMins * 60_000, endMs - minMs);
        } else {
          newEndMs = Math.max(endMs + deltaMins * 60_000, startMs + minMs);
        }
        if (newEndMs <= newStartMs) {
          newEndMs = newStartMs + minMs;
        }
        const newStart = new Date(newStartMs).toISOString();
        const newEnd = new Date(newEndMs).toISOString();
        setResize({
          eventId: event.id,
          previewStart: newStart,
          previewEnd: newEnd,
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove("dragging");
        setResize((current) => {
          if (
            current &&
            (current.previewStart !== event.start ||
              current.previewEnd !== event.end)
          ) {
            optsRef.current.onResize(
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

  const onHandlePointerDown = useCallback(
    (event: CalendarEvent, handle: ResizeHandle, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      begin(event, handle, e.clientY);
    },
    [begin]
  );

  const cancel = useCallback(() => {
    setResize(null);
    document.body.classList.remove("dragging");
  }, []);

  return { resize, onHandlePointerDown, cancel };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOUR_HEIGHT, snapMins as snapMinsFn } from "@/lib/calendar-ui";

export interface CreatePreview {
  startY: number; // px within the column
  endY: number; // px within the column
}

interface UseCreateDragOptions {
  onCreate: (defaults: { start: string; end: string }) => void;
  // given snapped minutes-since-midnight (start, end), produce the ISO strings
  rangeFromMins: (startMins: number, endMins: number) => { start: string; end: string };
}

// Touch-first create interaction (mirrors iOS Calendar):
//   - On TOUCH: a 1s long-press on empty space is required to start creating.
//     Swipes/scrolls before 1s cancel the timer — no dotted outline appears.
//     After 1s hold, the create sheet opens at the touched time.
//   - On MOUSE (desktop): click on empty space creates immediately (default 1h).
//     Press-and-drag sketches a time range (legacy behavior).
export function useCreateDrag({ onCreate, rangeFromMins }: UseCreateDragOptions) {
  const optsRef = useRef({ onCreate, rangeFromMins });
  useEffect(() => {
    optsRef.current = { onCreate, rangeFromMins };
  });
  const [preview, setPreview] = useState<CreatePreview | null>(null);
  const startRef = useRef<{ clientY: number; columnTop: number; isTouch: boolean } | null>(null);
  const movedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const isTouch = e.pointerType === "touch";
    const rect = e.currentTarget.getBoundingClientRect();
    startRef.current = { clientY: e.clientY, columnTop: rect.top, isTouch };
    movedRef.current = false;

    if (isTouch) {
      // TOUCH: do NOT show the dotted preview yet. Start a 1s timer. Only
      // after it fires do we activate create mode. If the finger moves
      // before 1s (scroll/swipe), cancel.
      originRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        // Timer fired → show create preview + open sheet on release.
        if (startRef.current) {
          setPreview({
            startY: startRef.current.clientY - startRef.current.columnTop,
            endY: startRef.current.clientY - startRef.current.columnTop,
          });
        }
      }, 1000);
    } else {
      // MOUSE: show preview immediately (desktop drag-to-create).
      setPreview({ startY: e.clientY - rect.top, endY: e.clientY - rect.top });
    }
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const start = startRef.current;
      if (!start) return;

      // For touch: cancel the create timer if the finger moves (it's a scroll).
      if (start.isTouch && timerRef.current && originRef.current) {
        const dx = Math.abs(e.clientX - originRef.current.x);
        const dy = Math.abs(e.clientY - originRef.current.y);
        if (dx > 8 || dy > 8) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          originRef.current = null;
          setPreview(null);
          return;
        }
      }

      const deltaY = e.clientY - start.clientY;
      if (Math.abs(deltaY) > 4) movedRef.current = true;
      // Only update preview if it's active (mouse always; touch only after timer).
      if (!start.isTouch || preview) {
        const endY = Math.max(0, e.clientY - start.columnTop);
        setPreview((cur) => (cur ? { ...cur, endY } : null));
      }
    };
    const onUp = (e: PointerEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      originRef.current = null;

      const wasPreview = preview;
      setPreview(null);
      if (!start) return;

      // Touch: if the timer fired (preview was shown), create at the held time.
      if (start.isTouch && wasPreview) {
        const y = start.clientY - start.columnTop;
        const mins = Math.max(0, Math.min(23 * 60 + 45, snapMinsFn((y / HOUR_HEIGHT) * 60)));
        const { start: isoStart, end: isoEnd } = optsRef.current.rangeFromMins(mins, mins + 60);
        optsRef.current.onCreate({ start: isoStart, end: isoEnd });
        return;
      }

      // Mouse: tap → default 1h (let onClick handle); drag → sketch range.
      if (!start.isTouch) {
        const y0 = start.clientY - start.columnTop;
        const y1 = Math.max(0, e.clientY - start.columnTop);
        const minsA = snapMinsFn((y0 / HOUR_HEIGHT) * 60);
        const minsB = snapMinsFn((y1 / HOUR_HEIGHT) * 60);
        if (!movedRef.current) {
          // pure tap → let the column's onClick handle it
          return;
        }
        const lo = Math.max(0, Math.min(minsA, minsB));
        const hi = Math.max(0, Math.max(minsA, minsB));
        if (hi - lo < 15) return;
        const { start: isoStart, end: isoEnd } = optsRef.current.rangeFromMins(lo, Math.max(hi, lo + 15));
        optsRef.current.onCreate({ start: isoStart, end: isoEnd });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [preview]);

  const consumeMoved = useCallback(() => {
    const was = movedRef.current;
    movedRef.current = false;
    return was;
  }, []);

  return { preview, onPointerDown, isCreating: preview !== null, movedRef, consumeMoved };
}

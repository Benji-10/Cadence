"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOUR_HEIGHT, snapMins } from "@/lib/calendar-ui";

export interface CreatePreview {
  startY: number; // px within the column
  endY: number; // px within the column
}

interface UseCreateDragOptions {
  onCreate: (defaults: { start: string; end: string }) => void;
  // given snapped minutes-since-midnight (start, end), produce the ISO strings
  rangeFromMins: (startMins: number, endMins: number) => { start: string; end: string };
}

// Press-and-drag in an empty part of the day column to sketch a new event's
// time range (iOS-style). A tap (no movement) falls back to a default 1h slot.
export function useCreateDrag({ onCreate, rangeFromMins }: UseCreateDragOptions) {
  const optsRef = useRef({ onCreate, rangeFromMins });
  useEffect(() => {
    optsRef.current = { onCreate, rangeFromMins };
  });
  const [preview, setPreview] = useState<CreatePreview | null>(null);
  const startRef = useRef<{ clientY: number; columnTop: number } | null>(null);
  const movedRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only start create-drag on the empty column itself (event blocks stop
    // propagation). Ignore right/middle clicks.
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    startRef.current = { clientY: e.clientY, columnTop: rect.top };
    movedRef.current = false;
    setPreview({ startY: e.clientY - rect.top, endY: e.clientY - rect.top });
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      const deltaY = e.clientY - start.clientY;
      if (Math.abs(deltaY) > 4) movedRef.current = true;
      const endY = Math.max(0, e.clientY - start.columnTop);
      setPreview((cur) => (cur ? { ...cur, endY } : null));
    };
    const onUp = (e: PointerEvent) => {
      const start = startRef.current;
      startRef.current = null;
      setPreview(null);
      if (!start) return;
      const y0 = start.clientY - start.columnTop;
      const y1 = Math.max(0, e.clientY - start.columnTop);
      const minsA = snapMins((y0 / HOUR_HEIGHT) * 60);
      const minsB = snapMins((y1 / HOUR_HEIGHT) * 60);
      if (!movedRef.current) {
        // pure tap → let the column's onClick handle it (default 1h)
        return;
      }
      const lo = Math.max(0, Math.min(minsA, minsB));
      const hi = Math.max(0, Math.max(minsA, minsB));
      if (hi - lo < 15) return; // too small, ignore
      const { start: isoStart, end: isoEnd } = optsRef.current.rangeFromMins(lo, Math.max(hi, lo + 15));
      optsRef.current.onCreate({ start: isoStart, end: isoEnd });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const consumeMoved = useCallback(() => {
    const was = movedRef.current;
    movedRef.current = false;
    return was;
  }, []);

  return { preview, onPointerDown, isCreating: preview !== null, movedRef, consumeMoved };
}

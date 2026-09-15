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

export interface InteractionState {
  mode: "idle" | "observing" | "active";
  eventId: string | null;
  viaLongPress: boolean; // true if activated via touch long-press (show quick actions)
}

export interface UseEventDragOptions {
  onMove: (event: CalendarEvent, newStart: string, newEnd: string) => void;
  onBlocked: (event: CalendarEvent) => void;
  // Snap increment in minutes (default 15).
  snapMins?: number;
  // Optional cross-day resolver.
  resolveNewTimes?: (
    event: CalendarEvent,
    clientX: number,
    originClientY: number,
    currentClientY: number
  ) => { newStart: string; newEnd: string } | null;
}

const LONG_PRESS_MS = 600; // ~0.6s hold to activate drag
const MOVE_THRESHOLD = 8; // px of movement before we consider it a swipe/scroll

// Touch-first interaction model (mirrors iOS Calendar):
//   1. pointerDown → start a timer, do NOT grab the touch (let scroll happen)
//   2. If pointer moves > MOVE_THRESHOLD before the timer → cancel (it's a scroll/swipe)
//   3. If pointer releases before the timer → it's a tap (caller opens edit sheet)
//   4. If the timer fires (LONG_PRESS_MS) → enter "active" drag mode: now grab
//      pointer events, show resize handles + quick actions, track movement.
//
// On desktop (mouse): skip the observing phase — drag starts immediately on
// pointerDown (mouse users expect immediate drag), same as before.
export function useEventDrag(opts: UseEventDragOptions) {
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const [drag, setDrag] = useState<DragPreview | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>({
    mode: "idle",
    eventId: null,
    viaLongPress: false,
  });
  const didDragRef = useRef(false);

  // Long-press timer + origin tracking.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number; event: CalendarEvent; isTouch: boolean } | null>(null);

  const resetDrag = useCallback(() => {
    didDragRef.current = false;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Begin active drag (called after long-press fires, or immediately for mouse).
  // The interaction state is set by the CALLER (with the correct viaLongPress flag).
  const beginActiveDrag = useCallback(
    (event: CalendarEvent, clientX: number, clientY: number, _isTouch: boolean) => {
      // NOTE: didDragRef starts false; it's only set true inside onMove when
      // the pointer actually moves. This way a mouse click (down+up, no move)
      // won't be treated as a drag, and onClick can open the edit sheet.

      const onMove = (e: PointerEvent) => {
        const deltaY = e.clientY - clientY;
        const deltaX = e.clientX - clientX;
        if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 8) didDragRef.current = true;

        let next: { newStart: string; newEnd: string } | null = null;
        if (optsRef.current.resolveNewTimes) {
          next = optsRef.current.resolveNewTimes(event, e.clientX, clientY, e.clientY);
        }
        if (!next) {
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
        setInteraction({ mode: "idle", eventId: null, viaLongPress: false });
        setDrag((current) => {
          if (current && current.previewStart !== event.start) {
            optsRef.current.onMove(event, current.previewStart, current.previewEnd);
          }
          return null;
        });
      };

      document.body.classList.add("dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    []
  );

  const onPointerDown = useCallback(
    (event: CalendarEvent, e: React.PointerEvent) => {
      const isTouch = e.pointerType === "touch";

      if (isTouch) {
        // TOUCH: start observing. Do NOT preventDefault/stopPropagation — let
        // the browser's native scroll/swipe work. Only grab the event after a
        // long-press timer fires.
        originRef.current = {
          x: e.clientX,
          y: e.clientY,
          event,
          isTouch: true,
        };
        setInteraction({ mode: "observing", eventId: event.id, viaLongPress: false });

        // Start the long-press timer.
        timerRef.current = setTimeout(() => {
          // Timer fired → enter active drag mode (via long-press).
          if (originRef.current && originRef.current.event.id === event.id) {
            setInteraction({ mode: "active", eventId: event.id, viaLongPress: true });
            beginActiveDrag(
              event,
              originRef.current.x,
              originRef.current.y,
              true
            );
            originRef.current = null;
          }
        }, LONG_PRESS_MS);
      } else {
        // MOUSE: drag starts immediately (desktop behavior, no long-press menu).
        e.preventDefault();
        e.stopPropagation();
        setInteraction({ mode: "active", eventId: event.id, viaLongPress: false });
        beginActiveDrag(event, e.clientX, e.clientY, false);
      }
    },
    [beginActiveDrag]
  );

  // Track pointer movement during the "observing" phase — if the finger moves
  // beyond the threshold, cancel the long-press (it's a scroll/swipe).
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (interaction.mode !== "observing" || !originRef.current) return;
      const dx = Math.abs(e.clientX - originRef.current.x);
      const dy = Math.abs(e.clientY - originRef.current.y);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        clearTimer();
        setInteraction({ mode: "idle", eventId: null, viaLongPress: false });
        originRef.current = null;
      }
    },
    [interaction.mode, clearTimer]
  );

  // If the pointer is released during "observing" (before long-press fires):
  // it's a tap → the caller's onClick handles opening the edit sheet.
  const onPointerUp = useCallback(() => {
    clearTimer();
    if (interaction.mode === "observing") {
      setInteraction({ mode: "idle", eventId: null, viaLongPress: false });
      originRef.current = null;
    }
  }, [interaction.mode, clearTimer]);

  const onPointerLeave = useCallback(() => {
    // Only cancel on leave for mouse (touch doesn't "leave").
    if (interaction.mode === "observing" && originRef.current && !originRef.current.isTouch) {
      clearTimer();
      setInteraction({ mode: "idle", eventId: null, viaLongPress: false });
      originRef.current = null;
    }
  }, [interaction.mode, clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    setDrag(null);
    setInteraction({ mode: "idle", eventId: null, viaLongPress: false });
    document.body.classList.remove("dragging");
  }, [clearTimer]);

  return {
    drag,
    interaction,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    didDragRef,
    resetDrag,
    cancel,
  };
}

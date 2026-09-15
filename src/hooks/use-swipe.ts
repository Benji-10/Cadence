"use client";

import { useRef, useEffect } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // px, default 50
}

// Lightweight touch swipe detection. Returns touch event handlers to spread
// onto an element. Fires onSwipeLeft/Right/Up/Down based on the dominant axis
// of movement exceeding the threshold. Does NOT interfere with vertical
// scrolling (only triggers on clearly horizontal movement, and vice versa).
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: SwipeHandlers) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const handlersRef = useRef({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown });
  useEffect(() => {
    handlersRef.current = { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown };
  });

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = startRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    startRef.current = null;

    if (absX > absY && absX > threshold) {
      if (dx < 0) handlersRef.current.onSwipeLeft?.();
      else handlersRef.current.onSwipeRight?.();
    } else if (absY > absX && absY > threshold) {
      if (dy < 0) handlersRef.current.onSwipeUp?.();
      else handlersRef.current.onSwipeDown?.();
    }
  };

  return { onTouchStart, onTouchEnd };
}

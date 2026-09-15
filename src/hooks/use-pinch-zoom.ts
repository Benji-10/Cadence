"use client";

import { useRef } from "react";

interface UsePinchZoomOptions {
  onZoom: (scale: number) => void; // scale > 1 = zoom in, < 1 = zoom out
}

// Detects two-finger pinch gestures on a touch element and fires onZoom with
// the scale delta. Used to adjust the calendar's hour-height (compactness)
// without moving event blocks.
export function usePinchZoom({ onZoom }: UsePinchZoomOptions) {
  const initialDist = useRef<number | null>(null);
  const lastDist = useRef<number | null>(null);

  const distance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = distance(e.touches);
      initialDist.current = d;
      lastDist.current = d;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDist.current && lastDist.current) {
      e.preventDefault(); // prevent page zoom
      const d = distance(e.touches);
      const scale = d / lastDist.current;
      onZoom(scale);
      lastDist.current = d;
    }
  };

  const onTouchEnd = () => {
    initialDist.current = null;
    lastDist.current = null;
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}

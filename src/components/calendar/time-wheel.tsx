"use client";

import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimeWheelProps {
  hour: number; // 0-23
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`,
}));

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
  value: m,
  label: String(m).padStart(2, "0"),
}));

const ITEM_H = 28; // px per item
const VISIBLE = 5; // visible items (odd for centering)

// A compact time selector with two scrollable columns (hour / minute).
// Items snap to the center; the selected value is highlighted. No dropdown
// chevron — the whole thing is always visible and touch-scrollable.
export function TimeWheel({ hour, minute, onChange }: TimeWheelProps) {
  const hourRef = useRef<HTMLDivElement | null>(null);
  const minuteRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);

  // Scroll to the correct position on mount and when the value changes externally.
  useEffect(() => {
    if (hourRef.current) {
      const idx = HOURS.findIndex((h) => h.value === hour);
      hourRef.current.scrollTop = idx * ITEM_H;
    }
    if (minuteRef.current) {
      const idx = MINUTES.findIndex((m) => m.value === minute);
      minuteRef.current.scrollTop = idx * ITEM_H;
    }
  }, [hour, minute, editing]);

  const handleScroll = (ref: React.RefObject<HTMLDivElement | null>, items: { value: number }[], onPick: (v: number) => void) => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    const v = items[clamped].value;
    onPick(v);
    // Snap
    ref.current.scrollTop = clamped * ITEM_H;
  };

  if (!editing) {
    // Compact display: "9:00 AM" — tap to expand the wheel.
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? "AM" : "PM";
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex h-7 items-center gap-1 rounded border border-input bg-background px-2 text-xs font-medium tabular-nums"
      >
        {h12}:{String(minute).padStart(2, "0")} {ampm}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-input bg-background p-1">
      {/* Hour column */}
      <div className="relative overflow-hidden" style={{ height: ITEM_H * VISIBLE, width: 56 }}>
        {/* Center highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 rounded bg-accent/50"
          style={{ top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H }}
        />
        <div
          ref={hourRef}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto"
          onScroll={() => {
            window.clearTimeout((hourRef.current as any)?._t);
            (hourRef.current as any)._t = window.setTimeout(
              () => handleScroll(hourRef, HOURS, (v) => onChange(v, minute)),
              80
            );
          }}
        >
          {/* Top padding */}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
          {HOURS.map((h) => (
            <div
              key={h.value}
              className="flex snap-center items-center justify-center text-xs tabular-nums"
              style={{ height: ITEM_H }}
            >
              {h.label}
            </div>
          ))}
          {/* Bottom padding */}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        </div>
      </div>

      <span className="text-xs text-muted-foreground">:</span>

      {/* Minute column */}
      <div className="relative overflow-hidden" style={{ height: ITEM_H * VISIBLE, width: 36 }}>
        <div
          className="pointer-events-none absolute inset-x-0 rounded bg-accent/50"
          style={{ top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H }}
        />
        <div
          ref={minuteRef}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto"
          onScroll={() => {
            window.clearTimeout((minuteRef.current as any)?._t);
            (minuteRef.current as any)._t = window.setTimeout(
              () => handleScroll(minuteRef, MINUTES, (v) => onChange(hour, v)),
              80
            );
          }}
        >
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
          {MINUTES.map((m) => (
            <div
              key={m.value}
              className="flex snap-center items-center justify-center text-xs tabular-nums"
              style={{ height: ITEM_H }}
            >
              {m.label}
            </div>
          ))}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        </div>
      </div>

      {/* Done button */}
      <button
        onClick={() => setEditing(false)}
        className="ml-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
      >
        Done
      </button>
    </div>
  );
}

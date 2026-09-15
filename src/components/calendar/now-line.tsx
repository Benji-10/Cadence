"use client";

import { useEffect, useState } from "react";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";

// Red current-time line spanning a single day column. Updates every 30s.
export function NowLine({ dayStartMs }: { dayStartMs: number }) {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const dayStart = new Date(dayStartMs);
      if (
        now.getFullYear() === dayStart.getFullYear() &&
        now.getMonth() === dayStart.getMonth() &&
        now.getDate() === dayStart.getDate()
      ) {
        const mins = now.getHours() * 60 + now.getMinutes();
        setTop((mins / 60) * HOUR_HEIGHT);
      } else {
        setTop(null);
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [dayStartMs]);

  if (top === null) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
      style={{ top }}
      aria-hidden
    >
      <span className="relative -left-[5px] h-[10px] w-[10px] rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]" />
      <div className="h-[2px] flex-1 bg-red-500" />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";
import { useSettings } from "@/lib/settings-store";

// Red current-time line spanning a single day column. Updates every 30s.
export function NowLine({ dayStartMs }: { dayStartMs: number }) {
  const hourHeight = useSettings((s) => s.hourHeight) ?? HOUR_HEIGHT;
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
        setTop((mins / 60) * hourHeight);
      } else {
        setTop(null);
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [dayStartMs, hourHeight]);

  if (top === null) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
      style={{ top }}
      aria-hidden
    >
      <span className="relative -left-[5px] flex h-[10px] w-[10px] items-center justify-center rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]">
        <span className="absolute size-[10px] animate-ping rounded-full bg-red-500/60" />
      </span>
      <div className="h-[2px] flex-1 bg-gradient-to-r from-red-500 to-red-500/40" />
      <span className="hidden -ml-1 rounded-sm bg-red-500 px-1 text-[9px] font-semibold text-white sm:inline">
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

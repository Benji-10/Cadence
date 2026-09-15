"use client";

import { HOUR_HEIGHT } from "@/lib/calendar-ui";

// Hour labels column. Renders 24 hour rows aligned with the day grid.
export function TimeAxis() {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div
      className="sticky left-0 z-20 w-14 shrink-0 bg-background/95 glass border-r border-border"
      aria-hidden
    >
      <div style={{ height: HOUR_HEIGHT }} className="border-b border-transparent" />
      {hours.map((h) => (
        <div
          key={h}
          className="relative text-right pr-2 text-[10px] font-medium text-muted-foreground/80"
          style={{ height: HOUR_HEIGHT }}
        >
          {h === 0 ? (
            <span className="absolute bottom-1 right-2">{formatHour(h)}</span>
          ) : (
            <span className="absolute -top-2 right-2">{formatHour(h)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "Noon";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

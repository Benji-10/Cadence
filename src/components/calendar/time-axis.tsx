"use client";

import { HOUR_HEIGHT } from "@/lib/calendar-ui";
import { useSettings } from "@/lib/settings-store";

// Hour labels column. Renders 24 hour rows aligned with the day grid.
// Each label sits at the BOTTOM of its hour-row so it aligns with the grid
// line that starts the NEXT hour — mirroring iOS Calendar (where "9 AM"
// appears just above the 9:00 line). The first row (00:00) has no label
// because the day-header occupies that space.
export function TimeAxis() {
  const hourHeight = useSettings((s) => s.hourHeight) ?? HOUR_HEIGHT;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div
      className="sticky left-0 z-20 w-14 shrink-0 bg-background/95 glass border-r border-border"
      aria-hidden
    >
      {hours.map((h) => (
        <div
          key={h}
          className="relative text-right pr-2 text-[10px] font-medium text-muted-foreground/80"
          style={{ height: hourHeight }}
        >
          {/* Label at the TOP of each hour row = the start of that hour.
              This aligns with the grid line drawn at h*hourHeight in the
              day column, so "9 AM" sits right on the 9:00 line. */}
          <span className="absolute top-[-6px] right-2 leading-none">
            {formatHour(h)}
          </span>
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

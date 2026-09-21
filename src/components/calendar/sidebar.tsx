"use client";

import { useMemo } from "react";
import { Check, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { useCalendarVisibility } from "./visibility-context";
import { MiniCalendar } from "./mini-calendar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  selectedDay: Date;
  events: CalendarEvent[];
  calendars: Calendar[];
  onSelectDay: (day: Date) => void;
  onNewEvent?: () => void;
}

// Desktop sidebar: mini-month for quick navigation + a compact calendar list
// with visibility toggles + a "New event" button. Hidden on screens below lg.
export function Sidebar({
  selectedDay,
  events,
  calendars,
  onSelectDay,
  onNewEvent,
}: SidebarProps) {
  const { visibility, toggle } = useCalendarVisibility();

  // Count events per calendar (visible range only) for the legend numbers.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      m.set(e.calendarId, (m.get(e.calendarId) ?? 0) + 1);
    }
    return m;
  }, [events]);

  const today = new Date();
  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => parseISO(e.start).getTime() >= now)
      .sort(
        (a, b) =>
          parseISO(a.start).getTime() - parseISO(b.start).getTime()
      )
      .slice(0, 4);
  }, [events]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/30 lg:flex">
      <div className="flex-1 overflow-y-auto cal-scroll p-3">
        <Button
          onClick={onNewEvent}
          className="mb-4 w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="size-4" />
          New event
        </Button>

        <MiniCalendar
          selected={selectedDay}
          events={events}
          onSelectDay={onSelectDay}
        />

        <div className="my-4 border-t border-border" />

        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Calendars
        </h3>
        <ul className="space-y-0.5">
          {calendars.map((c) => {
            const visible = visibility[c.id] ?? true;
            const count = counts.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <button
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50",
                    !visible && "opacity-50"
                  )}
                >
                  <span
                    className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border-2"
                    style={{ borderColor: c.color, backgroundColor: visible ? c.color : "transparent" }}
                  >
                    {visible && <Check className="size-2.5 text-white" />}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="my-4 border-t border-border" />

        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Up next
        </h3>
        {upcoming.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-1">
            {upcoming.map((ev) => {
              const cal = calendars.find((c) => c.id === ev.calendarId);
              const color = ev.color ?? cal?.color ?? "#64748B";
              const start = parseISO(ev.start);
              return (
                <li key={ev.id}>
                  <button
                    onClick={() => onSelectDay(start)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent/50"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{ev.title}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {format(start, "EEE d · HH:mm")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

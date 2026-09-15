"use client";

import { useMemo } from "react";
import {
  format,
  isSameDay,
  isToday,
  parseISO,
  differenceInMinutes,
} from "date-fns";
import { Lock, MapPin, Clock, ChevronRight, AlertTriangle } from "lucide-react";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { eventColor, conflictingEventIds } from "@/lib/calendar-ui";
import { useSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

interface AgendaViewProps {
  rangeStart: Date;
  rangeEnd: Date;
  events: CalendarEvent[];
  calendarsById: Record<string, Calendar | undefined>;
  hiddenCalendarIds: Set<string>;
  onSelect?: (event: CalendarEvent) => void;
  onPickDay?: (day: Date) => void;
}

export function AgendaView({
  rangeStart,
  rangeEnd,
  events,
  calendarsById,
  hiddenCalendarIds,
  onSelect,
  onPickDay,
}: AgendaViewProps) {
  // Group events by their start day, sorted.
  const grouped = useMemo(() => {
    const visible = events
      .filter((e) => !hiddenCalendarIds.has(e.calendarId))
      .filter((e) => {
        const s = parseISO(e.start);
        return s >= rangeStart && s < rangeEnd;
      })
      .sort(
        (a, b) =>
          parseISO(a.start).getTime() - parseISO(b.start).getTime()
      );

    const map = new Map<string, CalendarEvent[]>();
    for (const ev of visible) {
      const key = format(parseISO(ev.start), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries()).map(([key, evs]) => ({
      key,
      day: parseISO(key + "T00:00:00"),
      events: evs,
    }));
  }, [events, hiddenCalendarIds, rangeStart, rangeEnd]);

  // Conflict detection across the whole agenda range (so a conflict badge
  // appears on any row that overlaps another). Gated by the settings toggle.
  const showConflicts = useSettings((s) => s.showConflictBadges);
  const conflictIds = useMemo(
    () =>
      showConflicts
        ? conflictingEventIds(
            events.filter((e) => !hiddenCalendarIds.has(e.calendarId))
          )
        : new Set<string>(),
    [events, hiddenCalendarIds, showConflicts]
  );
  const conflictCount = conflictIds.size;

  if (grouped.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <Clock className="size-8 opacity-40" />
        <p className="text-sm">No events in this range.</p>
        <p className="text-xs">Tap a day in Month view to jump to it.</p>
      </div>
    );
  }

  return (
    <div className="cal-scroll h-full overflow-auto">
      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-6">
        {conflictCount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <span className="font-semibold">{conflictCount}</span> conflicting
              event{conflictCount === 1 ? "" : "s"} detected — overlapping times
              are highlighted below.
            </span>
          </div>
        )}
        {grouped.map(({ key, day, events: evs }) => {
          const today_ = isToday(day);
          const totalMins = evs.reduce(
            (sum, e) =>
              sum + differenceInMinutes(parseISO(e.end), parseISO(e.start)),
            0
          );
          const dayConflicts = evs.filter((e) => conflictIds.has(e.id)).length;
          return (
            <section key={key} className="mb-6">
              {/* Day header */}
              <button
                onClick={() => onPickDay?.(day)}
                className="sticky top-0 z-10 flex w-full items-center gap-2 rounded-md bg-background/90 px-2 py-1.5 text-left glass hover:bg-accent/40"
              >
                <span
                  className={cn(
                    "flex size-8 flex-col items-center justify-center rounded-lg text-xs font-semibold leading-none",
                    today_
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <span className="text-[9px] uppercase">
                    {format(day, "EEE")}
                  </span>
                  <span className="mt-0.5 text-sm">{format(day, "d")}</span>
                </span>
                <span className="text-sm font-medium">
                  {format(day, "EEEE, d MMMM yyyy")}
                </span>
                {today_ && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Today
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                  {dayConflicts > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 font-medium text-red-600 dark:text-red-400">
                      <AlertTriangle className="size-2.5" />
                      {dayConflicts} conflict{dayConflicts > 1 ? "s" : ""}
                    </span>
                  )}
                  <span>
                    {evs.length} event{evs.length > 1 ? "s" : ""} ·{" "}
                    {Math.floor(totalMins / 60)}h {totalMins % 60}m
                  </span>
                </span>
              </button>

              {/* Event rows */}
              <ul className="mt-1 space-y-1">
                {evs.map((ev) => {
                  const color = eventColor(ev, calendarsById);
                  const fixed = ev.flexibility === "fixed";
                  const start = parseISO(ev.start);
                  const end = parseISO(ev.end);
                  const dur = differenceInMinutes(end, start);
                  const upcoming = start.getTime() >= Date.now();
                  const conflict = conflictIds.has(ev.id);
                  return (
                    <li key={ev.id}>
                      <button
                        onClick={() => onSelect?.(ev)}
                        className={cn(
                          "group flex w-full items-stretch gap-2 rounded-lg border bg-card p-2 text-left transition-colors hover:bg-accent/40",
                          conflict
                            ? "border-red-500/50 hover:border-red-500"
                            : "border-border/60 hover:border-border"
                        )}
                      >
                        <span
                          className="w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="flex w-20 shrink-0 flex-col justify-center text-right">
                          <span className="text-sm font-semibold tabular-nums">
                            {format(start, "HH:mm")}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {format(end, "HH:mm")}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">
                              {ev.title}
                            </span>
                            {fixed && (
                              <Lock className="size-3 shrink-0 text-muted-foreground" />
                            )}
                            {conflict && (
                              <AlertTriangle className="size-3 shrink-0 text-red-500" />
                            )}
                          </span>
                          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="tabular-nums">
                              {dur < 60
                                ? `${dur}m`
                                : `${Math.floor(dur / 60)}h ${
                                    dur % 60 ? `${dur % 60}m` : ""
                                  }`}
                            </span>
                            {ev.location && (
                              <span className="flex min-w-0 items-center gap-0.5">
                                <MapPin className="size-3 shrink-0" />
                                <span className="truncate">{ev.location}</span>
                              </span>
                            )}
                          </span>
                        </span>
                        <span
                          className="flex items-center self-center text-[10px] font-medium"
                          style={{
                            color: upcoming ? color : undefined,
                          }}
                        >
                          {upcoming ? (
                            <RelativeTime iso={ev.start} />
                          ) : (
                            <span className="text-muted-foreground/70">done</span>
                          )}
                        </span>
                        <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const now = Date.now();
  const ms = parseISO(iso).getTime() - now;
  const mins = Math.round(ms / 60000);
  if (mins < 1) return <span className="text-emerald-600 dark:text-emerald-400">now</span>;
  if (mins < 60) return <span>in {mins}m</span>;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return <span>in {h}h{m ? ` ${m}m` : ""}</span>;
  const d = Math.floor(h / 24);
  return <span>in {d}d</span>;
}

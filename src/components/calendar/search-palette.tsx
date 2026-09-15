"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search, Calendar as CalIcon, MapPin, CornerDownLeft } from "lucide-react";
import { useSearchEvents } from "@/hooks/use-calendar-data";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { eventColor } from "@/lib/calendar-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  calendarsById: Record<string, Calendar | undefined>;
  onSelect: (event: CalendarEvent) => void; // jump to event
}

export function SearchPalette({
  open,
  onOpenChange,
  calendarsById,
  onSelect,
}: SearchPaletteProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useSearchEvents(q);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = search.data?.events ?? [];
  const upcoming = useMemo(
    () =>
      results
        .filter((e) => parseISO(e.end).getTime() >= Date.now())
        .sort(
          (a, b) =>
            parseISO(a.start).getTime() - parseISO(b.start).getTime()
        ),
    [results]
  );
  const past = useMemo(
    () =>
      results
        .filter((e) => parseISO(e.end).getTime() < Date.now())
        .sort(
          (a, b) =>
            parseISO(b.start).getTime() - parseISO(a.start).getTime()
        )
        .slice(0, 8),
    [results]
  );

  const list = [...upcoming, ...past];

  useEffect(() => {
    setActive(0);
  }, [q]);

  const choose = (ev: CalendarEvent) => {
    onSelect(ev);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden p-0"
        onCloseAutoFocus={() => inputRef.current?.blur()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search events</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(list.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && list[active]) {
                e.preventDefault();
                choose(list[active]);
              }
            }}
            placeholder="Search events by title…  (try 'work', 'lecture', 'laundry')"
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            esc
          </kbd>
        </div>

        <div className="cal-scroll max-h-[60vh] overflow-auto">
          {q.trim().length === 0 ? (
            <div className="flex flex-col gap-2 p-6 text-center text-sm text-muted-foreground">
              <Search className="mx-auto size-6 opacity-40" />
              <p>
                Type to search across all your events. Press{" "}
                <kbd className="rounded border border-border bg-muted px-1 text-[10px]">
                  ↵
                </kbd>{" "}
                to jump to one.
              </p>
            </div>
          ) : search.isFetching ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          ) : list.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No events match “{q}”.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.length > 0 && (
                <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Upcoming
                </li>
              )}
              {upcoming.map((ev, i) => (
                <SearchRow
                  key={ev.id}
                  ev={ev}
                  active={i === active}
                  calendarsById={calendarsById}
                  onClick={() => choose(ev)}
                  onHover={() => setActive(i)}
                  relative
                />
              ))}
              {past.length > 0 && (
                <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Past
                </li>
              )}
              {past.map((ev, i) => (
                <SearchRow
                  key={ev.id}
                  ev={ev}
                  active={upcoming.length + i === active}
                  calendarsById={calendarsById}
                  onClick={() => choose(ev)}
                  onHover={() => setActive(upcoming.length + i)}
                  relative
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchRow({
  ev,
  active,
  calendarsById,
  onClick,
  onHover,
  relative,
}: {
  ev: CalendarEvent;
  active: boolean;
  calendarsById: Record<string, Calendar | undefined>;
  onClick: () => void;
  onHover: () => void;
  relative?: boolean;
}) {
  const color = eventColor(ev, calendarsById);
  const start = parseISO(ev.start);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const inFuture = diffMs > 0;
  let rel: string | null = null;
  if (relative) {
    const mins = Math.round(Math.abs(diffMs) / 60000);
    const days = Math.floor(mins / (60 * 24));
    const hrs = Math.floor(mins / 60);
    if (days >= 2) rel = inFuture ? `in ${days}d` : `${days}d ago`;
    else if (hrs >= 1) rel = inFuture ? `in ${hrs}h` : `${hrs}h ago`;
    else rel = inFuture ? `in ${mins}m` : `${mins}m ago`;
  }
  return (
    <li>
      <button
        onClick={onClick}
        onMouseEnter={onHover}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          active && "bg-accent"
        )}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{ev.title}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalIcon className="size-3" />
            <span>{format(start, "EEE d MMM · HH:mm")}</span>
            {ev.location && (
              <>
                <MapPin className="size-3" />
                <span className="truncate">{ev.location}</span>
              </>
            )}
          </div>
        </div>
        {rel && (
          <span
            className={cn(
              "shrink-0 text-[10px] font-medium",
              inFuture ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            {rel}
          </span>
        )}
        {active && (
          <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" />
        )}
      </button>
    </li>
  );
}

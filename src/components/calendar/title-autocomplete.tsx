"use client";

import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api-client";
import type { Calendar, CalendarEvent } from "@/lib/types";
import { eventColor } from "@/lib/calendar-ui";
import { cn } from "@/lib/utils";

interface TitleAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (event: CalendarEvent) => void;
  calendarsById: Record<string, Calendar | undefined>;
}

export function TitleAutocomplete({
  value,
  onChange: _onChange,
  onSelect,
  calendarsById,
}: TitleAutocompleteProps) {
  const debounced = useDebounce(value, 250);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [fetched, setFetched] = useState<CalendarEvent[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 3) {
      const id = setTimeout(() => {
        setFetched([]);
        setOpen(false);
      }, 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    api
      .searchEvents(q, 8)
      .then((res) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const unique = res.events.filter((e) => {
          const key = e.title.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setFetched(unique);
        if (unique.length > 0) {
          setOpen(true);
          setActive(0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const pick = (ev: CalendarEvent) => {
    onSelect(ev);
    setOpen(false);
  };

  if (!open || fetched.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute left-4 right-4 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg"
    >
      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Previous events
      </div>
      <ul className="cal-scroll max-h-48 overflow-auto pb-1">
        {fetched.map((ev, i) => {
          const color = eventColor(ev, calendarsById);
          return (
            <li key={ev.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => {
                  e.stopPropagation();
                  pick(ev);
                }}
                className={cn(
                  "flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
                  i === active ? "bg-accent" : "hover:bg-accent/50"
                )}
              >
                <span
                  className="mt-0.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {ev.title}
                  </span>
                  {ev.location && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {ev.location}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


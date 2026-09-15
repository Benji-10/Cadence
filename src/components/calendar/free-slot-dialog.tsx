"use client";

import { useMemo, useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { CalendarSearch, Clock, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalendarEvent, LocationType } from "@/lib/types";
import { findFreeGaps } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

interface FreeSlotDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: CalendarEvent[];
  rangeStart: string;
  rangeEnd: string;
  onPick: (start: string, end: string) => void;
}

const DURATIONS = [15, 30, 60, 90, 120, 180];

export function FreeSlotDialog({
  open,
  onOpenChange,
  events,
  rangeStart,
  rangeEnd,
  onPick,
}: FreeSlotDialogProps) {
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState<LocationType>("any");

  const slots = useMemo(() => {
    const fixed = events.filter((e) => e.flexibility === "fixed");
    const gaps = findFreeGaps(fixed, rangeStart, rangeEnd);
    return gaps
      .map((g) => ({
        ...g,
        durationMins: differenceInMinutes(parseISO(g.end), parseISO(g.start)),
      }))
      .filter((g) => g.durationMins >= duration)
      .filter((g) => location === "any" || g.locationType === location || g.locationType === "any")
      .slice(0, 12);
  }, [events, rangeStart, rangeEnd, duration, location]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarSearch className="size-4 text-emerald-600" />
            Find a free slot
          </DialogTitle>
          <DialogDescription>
            Search for an available window in the visible range. Fixed events
            (lectures, sport, sleep) define the gaps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Duration + location filters */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Need
              </label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d < 60 ? `${d} min` : `${d / 60}h${d % 60 ? ` ${d % 60}m` : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Location
              </label>
              <Select
                value={location}
                onValueChange={(v) => setLocation(v as LocationType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Anywhere</SelectItem>
                  <SelectItem value="home">At home</SelectItem>
                  <SelectItem value="campus">On campus</SelectItem>
                  <SelectItem value="sports">At sports centre</SelectItem>
                  <SelectItem value="out">Out & about</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Slots list */}
          <div className="cal-scroll max-h-[50vh] space-y-1.5 overflow-auto">
            {slots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                <Clock className="size-6 opacity-40" />
                <p className="text-sm">
                  No {duration}-minute slot
                  {location !== "any" ? ` at ${location}` : ""} in this range.
                </p>
                <p className="text-xs">Try a shorter duration or widen the range.</p>
              </div>
            ) : (
              slots.map((s, i) => {
                const start = parseISO(s.start);
                const end = parseISO(s.end);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const sliceEnd = new Date(start.getTime() + duration * 60_000);
                      onPick(s.start, sliceEnd.toISOString());
                      onOpenChange(false);
                    }}
                    className="group flex w-full items-center gap-3 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-500/5"
                  >
                    <div className="flex size-10 flex-col items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <span className="text-[9px] font-semibold uppercase">
                        {format(start, "EEE")}
                      </span>
                      <span className="text-sm font-bold">{format(start, "d")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium tabular-nums">
                        {format(start, "HH:mm")}–{format(end, "HH:mm")}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">
                          {s.durationMins < 60
                            ? `${s.durationMins}m free`
                            : `${Math.floor(s.durationMins / 60)}h ${s.durationMins % 60}m free`}
                        </span>
                        {s.locationType !== "any" && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="size-2.5" />
                            {s.locationType}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
                      Use →
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

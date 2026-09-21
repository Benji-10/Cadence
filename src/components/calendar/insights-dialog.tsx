"use client";

import { useMemo } from "react";
import { differenceInMinutes, parseISO } from "date-fns";
import {
  Clock,
  BookOpen,
  Dumbbell,
  Briefcase,
  Home as HomeIcon,
  Users,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { categoryLabel } from "@/lib/calendar-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InsightsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: CalendarEvent[];
  rangeStart: string;
  rangeEnd: string;
}

// Category → colour (mirrors the palette in categories.ts).
const CAT_COLORS: Record<string, string> = {
  lecture: "#F59E0B",
  sport: "#10B981",
  work: "#EF4444",
  homework: "#8B5CF6",
  language: "#EC4899",
  coding: "#14B8A6",
  ppl: "#3B82F6",
  cubing: "#A855F7",
  laundry: "#06B6D4",
  cooking: "#F97316",
  shopping: "#0EA5E9",
  social: "#22C55E",
  travel: "#9CA3AF",
  sleep: "#6366F1",
  free: "#D1D5DB",
  other: "#64748B",
};

export function InsightsDialog({
  open,
  onOpenChange,
  events,
  rangeStart,
  rangeEnd,
}: InsightsDialogProps) {
  const stats = useMemo(() => {
    const visible = events.filter((e) => {
      const s = parseISO(e.start);
      return s >= parseISO(rangeStart) && s < parseISO(rangeEnd);
    });

    const byCategory = new Map<string, number>(); // minutes
    let totalMins = 0;
    let fixedMins = 0;
    let flexMins = 0;
    let busiest = { day: "—", mins: 0 };
    const byDay = new Map<string, number>();

    for (const ev of visible) {
      const mins = differenceInMinutes(parseISO(ev.end), parseISO(ev.start));
      totalMins += mins;
      byCategory.set(
        ev.category,
        (byCategory.get(ev.category) ?? 0) + mins
      );
      if (ev.flexibility === "fixed") fixedMins += mins;
      else flexMins += mins;

      const dayKey = new Date(parseISO(ev.start)).toDateString();
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + mins);
      if ((byDay.get(dayKey) ?? 0) > busiest.mins) {
        busiest = { day: dayKey, mins: byDay.get(dayKey)! };
      }
    }

    const sorted = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, mins]) => ({
        cat,
        mins,
        label: categoryLabel(cat),
        color: CAT_COLORS[cat] ?? "#64748B",
        pct: totalMins > 0 ? (mins / totalMins) * 100 : 0,
      }));

    const fmtH = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;

    return {
      total: visible.length,
      totalMins,
      fixedMins,
      flexMins,
      busiest,
      sorted,
      fmtH,
    };
  }, [events, rangeStart, rangeEnd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" />
            Week insights
          </DialogTitle>
        </DialogHeader>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={<Clock className="size-4 text-emerald-600" />}
            label="Scheduled"
            value={stats.fmtH(stats.totalMins)}
          />
          <StatCard
            icon={<TrendingUp className="size-4 text-emerald-600" />}
            label="Events"
            value={String(stats.total)}
          />
          <StatCard
            icon={<Briefcase className="size-4 text-amber-500" />}
            label="Fixed time"
            value={stats.fmtH(stats.fixedMins)}
            hint={`${Math.round((stats.fixedMins / Math.max(stats.totalMins, 1)) * 100)}% locked`}
          />
          <StatCard
            icon={<Sparkles className="size-4 text-violet-500" />}
            label="Flexible"
            value={stats.fmtH(stats.flexMins)}
            hint="can be rearranged"
          />
        </div>

        {/* Category breakdown bar */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Time by category
          </h3>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {stats.sorted.map((c) => (
              <div
                key={c.cat}
                className="h-full transition-all"
                style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                title={`${c.label}: ${stats.fmtH(c.mins)}`}
              />
            ))}
          </div>
          {/* Legend list */}
          <ul className="mt-3 space-y-1.5">
            {stats.sorted.slice(0, 8).map((c) => (
              <li key={c.cat} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="flex-1 truncate">{c.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {stats.fmtH(c.mins)}
                </span>
                <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
                  {Math.round(c.pct)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Busiest day */}
        {stats.busiest.mins > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">Busiest day: </span>
            <span className="font-medium">
              {new Date(stats.busiest.day).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </span>
            <span className="text-muted-foreground">
              {" "}
              — {stats.fmtH(stats.busiest.mins)} scheduled
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tip: tap <span className="font-medium">Auto-optimize</span> to let
          Cadence rearrange flexible tasks around your fixed commitments.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

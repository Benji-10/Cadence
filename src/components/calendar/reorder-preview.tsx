"use client";

import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent, ReorderResult } from "@/lib/types";
import { useBulkUpdateEvents } from "@/hooks/use-calendar-data";
import { toast } from "sonner";

interface ReorderPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ReorderResult | null;
  events: CalendarEvent[]; // for resolving titles in the change list
  loading?: boolean;
  onApplied?: () => void;
}

export function ReorderPreview({
  open,
  onOpenChange,
  result,
  events,
  loading,
  onApplied,
}: ReorderPreviewProps) {
  const bulk = useBulkUpdateEvents();

  const changes = result?.changes ?? [];
  const notes = result?.notes ?? [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const handleApply = async () => {
    if (!result) return;
    const updates = changes.map((c) => ({
      id: c.eventId,
      patch: { start: c.toStart, end: c.toEnd },
    }));
    if (updates.length > 0) {
      try {
        await bulk.mutateAsync(updates);
        toast.success(
          `Week optimized — ${updates.length} task${updates.length > 1 ? "s" : ""} moved.`
        );
      } catch (e) {
        toast.error("Couldn't apply all changes", { description: String(e) });
      }
    }
    onApplied?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" />
            Auto-optimize preview
          </DialogTitle>
          <DialogDescription>
            Review what Cadence would change. Nothing is saved until you apply it.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Crunching your week…
          </div>
        ) : changes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nothing to optimize — your week is already tidy.
          </div>
        ) : (
          <motion.ul
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-h-72 space-y-2 overflow-y-auto cal-scroll pr-1"
          >
            {changes.map((c) => {
              const ev = eventById.get(c.eventId);
              const title = ev?.title ?? "Event";
              return (
                <li
                  key={c.eventId}
                  className="rounded-md border border-border bg-card p-2 text-xs"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{title}</span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="shrink-0 text-foreground">
                      {format(parseISO(c.toStart), "EEE HH:mm")}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <span>was {format(parseISO(c.fromStart), "EEE HH:mm")}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{c.reason}</p>
                </li>
              );
            })}
          </motion.ul>
        )}

        {notes.length > 0 && (
          <div className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="mb-1 font-semibold">Notes</div>
            <ul className="list-inside list-disc space-y-0.5">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={bulk.isPending || changes.length === 0}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="size-3.5" />
            Apply {changes.length > 0 && `(${changes.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

void Badge; // (kept import for future use if we add badges to the list)

"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Calendar } from "@/lib/types";
import { useCalendars, useCreateCalendar } from "@/hooks/use-calendar-data";
import { useCalendarVisibility } from "./visibility-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PALETTE = [
  "#F59E0B", "#10B981", "#EF4444", "#06B6D4", "#22C55E", "#A855F7",
  "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#0EA5E9", "#64748B",
];

export function CalendarManager() {
  const { visibility, toggle } = useCalendarVisibility();
  const { data } = useCalendars();
  const calendars: Calendar[] = data?.calendars ?? [];
  const createCal = useCreateCalendar();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[1]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Give the calendar a name first");
      return;
    }
    try {
      await createCal.mutateAsync({ name: name.trim(), color });
      setName("");
      toast.success(`Created "${name.trim() || "Calendar"}"`);
    } catch (e) {
      toast.error("Couldn't create calendar", { description: String(e) });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Calendars
      </div>
      <ul className="flex flex-col gap-1">
        {calendars.map((c) => {
          const visible = visibility?.[c.id] ?? true;
          return (
            <li key={c.id}>
              <button
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span
                  className="inline-flex size-4 items-center justify-center rounded-[5px] border-2"
                  style={{ borderColor: c.color }}
                >
                  {visible && (
                    <span
                      className="size-2 rounded-[2px]"
                      style={{ backgroundColor: c.color }}
                    />
                  )}
                </span>
                <span className="flex-1 text-left">{c.name}</span>
                {visible && <Check className="size-3.5 text-muted-foreground" />}
              </button>
            </li>
          );
        })}
        {calendars.length === 0 && (
          <li className="px-2 py-2 text-xs text-muted-foreground">No calendars yet.</li>
        )}
      </ul>

      <div className="border-t border-border pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          New calendar
        </div>
        <div className="flex flex-col gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Calendar name"
            className="h-8"
          />
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((p) => (
              <button
                key={p}
                onClick={() => setColor(p)}
                className={cn(
                  "size-5 rounded-full ring-2 ring-offset-1 ring-offset-background transition-transform hover:scale-110",
                  color === p ? "ring-foreground" : "ring-transparent"
                )}
                style={{ backgroundColor: p }}
                aria-label={`Pick color ${p}`}
              />
            ))}
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createCal.isPending || !name.trim()}
            className="mt-1 gap-1.5"
          >
            <Plus className="size-3.5" />
            Add calendar
          </Button>
        </div>
      </div>
    </div>
  );
}

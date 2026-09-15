"use client";

import { useMemo } from "react";
import { Zap, X } from "lucide-react";
import { useTemplates } from "@/lib/templates-store";
import { useCalendars } from "@/hooks/use-calendar-data";
import { inferMetaFromTitle } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

interface TemplatesBarProps {
  // Called when a template is picked — parent applies the template's fields
  // to the in-progress event.
  onApply: (fields: {
    title: string;
    durationMins: number;
    calendarId?: string;
    location?: string;
    color?: string | null;
    category?: string;
    flexibility?: string;
    locationType?: string;
  }) => void;
}

// A horizontal strip of quick-add template chips shown in the create-mode
// edit sheet. Clicking a chip fills the form with the template's values.
export function TemplatesBar({ onApply }: TemplatesBarProps) {
  const templates = useTemplates((s) => s.templates);
  const removeTemplate = useTemplates((s) => s.removeTemplate);
  const { data: calData } = useCalendars();
  const calendars = calData?.calendars ?? [];

  const enriched = useMemo(
    () =>
      templates.map((t) => {
        const cal = calendars.find((c) => c.id === t.calendarId);
        const color = t.color ?? cal?.color ?? inferMetaFromTitle(t.title).color;
        return { ...t, color };
      }),
    [templates, calendars]
  );

  if (enriched.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <Zap className="size-3" />
        <span>
          No quick-add templates yet. Save the current event as a template to
          reuse it next time.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {enriched.map((t) => (
        <div
          key={t.id}
          className="group relative flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-2.5 pr-1 transition-colors hover:bg-accent/40"
        >
          <button
            onClick={() =>
              onApply({
                title: t.title,
                durationMins: t.durationMins,
                calendarId: t.calendarId ?? undefined,
                location: t.location,
                color: t.color,
                category: t.category,
                flexibility: t.flexibility,
                locationType: t.locationType,
              })
            }
            className="flex items-center gap-1.5 text-[11px] font-medium"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            {t.title}
          </button>
          <button
            onClick={() => removeTemplate(t.id)}
            className="rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
            aria-label={`Remove template ${t.title}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

"use client";

import { memo, type MutableRefObject } from "react";
import { Lock, MapPin, GripVertical } from "lucide-react";
import type { Calendar, CalendarEvent } from "@/lib/types";
import {
  contrastText,
  eventColor,
  fmtTime,
  heightForEvent,
  hexToRgba,
  topForEvent,
} from "@/lib/calendar-ui";
import { cn } from "@/lib/utils";
import type { DragPreview } from "@/hooks/use-event-drag";
import type { ResizePreview } from "@/hooks/use-event-resize";

interface EventBlockProps {
  event: CalendarEvent;
  lane: number;
  lanesInCluster: number;
  calendarsById: Record<string, Calendar | undefined>;
  selected?: boolean;
  isGhost?: boolean;
  dragPreview?: DragPreview | null;
  resizePreview?: ResizePreview | null;
  didDragRef?: MutableRefObject<boolean>;
  onPointerDown?: (event: CalendarEvent, e: React.PointerEvent) => void;
  onHandlePointerDown?: (
    event: CalendarEvent,
    handle: "top" | "bottom",
    e: React.PointerEvent
  ) => void;
  onSelect?: (event: CalendarEvent) => void;
}

function EventBlockImpl({
  event,
  lane,
  lanesInCluster,
  calendarsById,
  selected,
  isGhost,
  dragPreview,
  resizePreview,
  didDragRef,
  onPointerDown,
  onHandlePointerDown,
  onSelect,
}: EventBlockProps) {
  const color = eventColor(event, calendarsById);
  const text = contrastText(color);

  // Use preview times when this event is being dragged or resized.
  const previewStart =
    (dragPreview?.eventId === event.id && dragPreview.previewStart) ||
    (resizePreview?.eventId === event.id && resizePreview.previewStart) ||
    event.start;
  const previewEnd =
    (dragPreview?.eventId === event.id && dragPreview.previewEnd) ||
    (resizePreview?.eventId === event.id && resizePreview.previewEnd) ||
    event.end;

  const top = topForEvent(previewStart);
  const height = Math.max(
    22,
    heightForEvent(previewStart, previewEnd)
  );
  const widthPct = 100 / lanesInCluster;
  const leftPct = lane * widthPct;

  const short = height < 36;
  const veryShort = height < 28;
  const flexible = event.flexibility !== "fixed";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${event.title}, ${fmtTime(previewStart)} to ${fmtTime(previewEnd)}${
        event.location ? ", at " + event.location : ""
      }`}
      onPointerDown={(e) => onPointerDown?.(event, e)}
      onClick={(e) => {
        // Skip click after a drag (pointer moved > threshold).
        if (didDragRef?.current) {
          didDragRef.current = false;
          return;
        }
        if (e.detail === 0) return;
        if (dragPreview || resizePreview) return;
        e.stopPropagation();
        onSelect?.(event);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(event);
        }
      }}
      className={cn(
        "group absolute z-10 cursor-grab touch-none select-none rounded-md text-left",
        "transition-shadow hover:z-20 hover:shadow-md active:cursor-grabbing",
        selected && "ring-2 ring-offset-1 ring-offset-background",
        isGhost && "opacity-60 ring-2 ring-dashed"
      )}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: hexToRgba(color, 0.92),
        color: text,
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 4px 14px ${hexToRgba(color, 0.35)}`
          : `0 1px 3px ${hexToRgba(color, 0.25)}`,
      }}
    >
      {/* left color bar — always shown */}
      <span
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-md"
        style={{ backgroundColor: color }}
      />
      {/* flexible indicator — dotted left accent */}
      {flexible && !isGhost && (
        <span
          className="absolute inset-y-0 left-[3px] w-[2px] opacity-50"
          style={{
            backgroundImage: `repeating-linear-gradient(to bottom, ${text} 0 3px, transparent 3px 6px)`,
          }}
        />
      )}

      {/* resize handles — only for non-fixed events */}
      {flexible && onHandlePointerDown && (
        <>
          <span
            onPointerDown={(e) => onHandlePointerDown?.(event, "top", e)}
            className="absolute -top-1 inset-x-0 h-3 cursor-ns-resize touch-none"
            aria-hidden
          >
            <span className="mx-auto mt-1 block h-1 w-8 rounded-full bg-black/20 group-hover:bg-black/35" />
          </span>
          <span
            onPointerDown={(e) => onHandlePointerDown?.(event, "bottom", e)}
            className="absolute -bottom-1 inset-x-0 h-3 cursor-ns-resize touch-none"
            aria-hidden
          >
            <span className="mx-auto mt-1 block h-1 w-8 rounded-full bg-black/20 group-hover:bg-black/35" />
          </span>
        </>
      )}

      {/* content */}
      <div className="flex h-full flex-col gap-0.5 overflow-hidden pl-2.5 pr-1.5 pt-1">
        <div className="flex items-start justify-between gap-1">
          <span
            className={cn(
              "truncate font-semibold leading-tight",
              veryShort ? "text-[10px]" : short ? "text-[11px]" : "text-xs"
            )}
          >
            {event.title || "Untitled"}
          </span>
          {event.flexibility === "fixed" && !short && (
            <Lock className="mt-[1px] size-3 shrink-0 opacity-80" />
          )}
        </div>
        {!veryShort && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] opacity-80",
              short && "sr-only"
            )}
          >
            <span>
              {fmtTime(previewStart)}–{fmtTime(previewEnd)}
            </span>
          </div>
        )}
        {!short && event.location && (
          <div className="flex items-center gap-1 truncate text-[10px] opacity-75">
            <MapPin className="size-2.5 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
      </div>

      {/* drag affordance on hover */}
      {flexible && !isGhost && (
        <GripVertical className="absolute right-0.5 bottom-0.5 size-3 opacity-0 group-hover:opacity-40" />
      )}
    </div>
  );
}

export const EventBlock = memo(EventBlockImpl);

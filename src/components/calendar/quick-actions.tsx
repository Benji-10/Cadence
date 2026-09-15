"use client";

import { Copy, Trash2, Pencil, Move, Plus } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children?: React.ReactNode; // the trigger (the event block)
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onDuplicate: (event: CalendarEvent) => void;
  onMoveMode: (event: CalendarEvent) => void;
}

// A small popover of quick actions shown when long-pressing an event on
// mobile (or right-clicking on desktop). Mirrors iOS's long-press menu.
export function QuickActions({
  event,
  open,
  onOpenChange,
  children,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveMode,
}: QuickActionsProps) {
  if (!event) return <>{children}</>;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={8}
        className="w-48 p-1"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {event.title}
        </div>
        <QuickAction icon={<Pencil className="size-4" />} label="Edit" onClick={() => { onEdit(event); onOpenChange(false); }} />
        <QuickAction icon={<Move className="size-4" />} label="Move" onClick={() => { onMoveMode(event); onOpenChange(false); }} />
        <QuickAction icon={<Copy className="size-4" />} label="Duplicate" onClick={() => { onDuplicate(event); onOpenChange(false); }} />
        <div className="my-1 h-px bg-border" />
        <QuickAction
          icon={<Trash2 className="size-4" />}
          label="Delete"
          destructive
          onClick={() => { onDelete(event); onOpenChange(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
        destructive && "text-destructive hover:bg-destructive/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

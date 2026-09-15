"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Navigate",
    items: [
      { keys: ["J"], label: "Previous day/week/month" },
      { keys: ["K"], label: "Next day/week/month" },
      { keys: ["←"], label: "Previous" },
      { keys: ["→"], label: "Next" },
      { keys: ["T"], label: "Jump to today" },
    ],
  },
  {
    title: "Views",
    items: [
      { keys: ["D"], label: "Day view" },
      { keys: ["W"], label: "Week view" },
      { keys: ["M"], label: "Month view" },
      { keys: ["A"], label: "Agenda / list view" },
    ],
  },
  {
    title: "Actions",
    items: [
      { keys: ["N"], label: "New event (now)" },
      { keys: ["⌘", "K"], label: "Search events" },
      { keys: ["/"], label: "Search events" },
      { keys: ["?"], label: "Show this help" },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li
                    key={it.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-foreground">{it.label}</span>
                    <span className="flex items-center gap-1">
                      {it.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-[1.5rem] rounded border border-border bg-muted px-1.5 py-0.5 text-center text-[10px] font-medium text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            On mobile, all actions are also available from the toolbar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

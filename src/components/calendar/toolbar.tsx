"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Bell,
  BellOff,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Moon,
  Keyboard,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarManager } from "./calendar-manager";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  visibleDate: Date;
  view: "day" | "week" | "month";
  onViewChange: (v: "day" | "week" | "month") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAutoOptimize: () => void;
  onReseed: () => void;
  notificationPermission?: NotificationPermission | "unsupported";
  onEnableNotifications: () => void;
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
}

export function Toolbar({
  visibleDate,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onAutoOptimize,
  onReseed,
  notificationPermission,
  onEnableNotifications,
  onOpenSearch,
  onOpenShortcuts,
}: ToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [calendarsOpen, setCalendarsOpen] = useState(false);

  return (
    <header
      className="glass sticky top-0 z-30 border-b border-border bg-background/80"
      role="banner"
    >
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        {/* Wordmark */}
        <div className="flex items-center gap-1.5">
          <span className="relative inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarDays className="size-4" />
            <Sparkles className="absolute -right-0.5 -top-0.5 size-3 text-amber-400" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Cadence
          </span>
        </div>

        {/* Center navigation */}
        <div className="mx-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Previous">
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToday} className="px-3">
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label="Next">
            <ChevronRight className="size-5" />
          </Button>
          <div className="ml-1 hidden min-w-[140px] text-center text-sm font-semibold sm:min-w-[200px] sm:text-base md:block">
            {view === "week"
              ? format(visibleDate, "MMM yyyy")
              : view === "month"
              ? format(visibleDate, "MMMM yyyy")
              : format(visibleDate, "MMM d, yyyy")}
          </div>
          {/* Compact label for small screens */}
          <div className="ml-1 min-w-[110px] text-center text-sm font-semibold sm:hidden">
            {view === "week"
              ? format(visibleDate, "MMM yyyy")
              : view === "month"
              ? format(visibleDate, "MMM yyyy")
              : format(visibleDate, "MMM d")}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search (cmd-k) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSearch}
            aria-label="Search events"
            title="Search (⌘K)"
          >
            <Search className="size-4" />
          </Button>

          {/* Day/Week/Month segmented toggle */}
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            <SegBtn active={view === "day"} onClick={() => onViewChange("day")}>
              Day
            </SegBtn>
            <SegBtn active={view === "week"} onClick={() => onViewChange("week")}>
              Week
            </SegBtn>
            <SegBtn active={view === "month"} onClick={() => onViewChange("month")}>
              Month
            </SegBtn>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onAutoOptimize}
            className="hidden gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:inline-flex"
          >
            <Sparkles className="size-3.5" />
            Auto-optimize
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={onAutoOptimize}
            className="bg-emerald-600 text-white hover:bg-emerald-700 sm:hidden"
            aria-label="Auto-optimize"
          >
            <Sparkles className="size-4" />
          </Button>

          {/* Calendars */}
          <Popover open={calendarsOpen} onOpenChange={setCalendarsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <span className="hidden sm:inline">Calendars</span>
                <span className="sm:hidden">Cals</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <CalendarManager />
            </PopoverContent>
          </Popover>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onEnableNotifications}
            aria-label="Notifications"
          >
            {notificationPermission === "granted" ? (
              <Bell className="size-4 text-emerald-600" />
            ) : notificationPermission === "denied" ? (
              <BellOff className="size-4 text-muted-foreground" />
            ) : (
              <Bell className="size-4" />
            )}
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onReseed}>
                <RefreshCw className="size-4" />
                Reset to sample schedule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenShortcuts}>
                <Keyboard className="size-4" />
                Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  window.open("/manifest.webmanifest", "_blank")
                }
              >
                <Plus className="size-4" />
                Install as app
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

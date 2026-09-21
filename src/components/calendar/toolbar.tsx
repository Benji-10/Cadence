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
  Download,
  Upload,
  BarChart3,
  Settings,
  CalendarSearch,
  Undo2,
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
import { NetlifyIdentityButton } from "./netlify-identity-button";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  visibleDate: Date;
  view: "day" | "week" | "month" | "year" | "agenda";
  onViewChange: (v: "day" | "week" | "month" | "year" | "agenda") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAutoOptimize: () => void;
  onReseed: () => void;
  notificationPermission?: NotificationPermission | "unsupported";
  onEnableNotifications: () => void;
  onOpenSearch: () => void;
  onOpenShortcuts: () => void;
  onOpenInsights: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenFreeSlot: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onLabelClick: () => void;
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
  onOpenInsights,
  onOpenImport,
  onOpenSettings,
  onOpenFreeSlot,
  onUndo,
  canUndo,
  onLabelClick,
}: ToolbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [calendarsOpen, setCalendarsOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-background"
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
        <div className="mx-auto flex items-center gap-0.5 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Previous" className="size-7">
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToday} className="px-1.5 text-[11px] sm:px-3 sm:text-sm">
            <span className="sm:hidden">Now</span>
            <span className="hidden sm:inline">Today</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onNext} aria-label="Next" className="size-7">
            <ChevronRight className="size-3.5" />
          </Button>
          {/* Full date label — desktop only. Clickable to zoom out (Day→Month→Year). */}
          <button
            onClick={onLabelClick}
            className="ml-1 hidden min-w-[140px] cursor-pointer rounded-md px-2 py-1 text-center text-sm font-semibold transition-colors hover:bg-accent sm:min-w-[200px] sm:text-base md:block"
            title="Click to zoom out"
          >
            {view === "week"
              ? format(visibleDate, "MMM yyyy")
              : view === "month"
              ? format(visibleDate, "MMMM yyyy")
              : view === "year"
              ? format(visibleDate, "yyyy")
              : format(visibleDate, "MMM d, yyyy")}
          </button>
          {/* Compact label for small screens — also clickable. Hidden on md+. */}
          <button
            onClick={onLabelClick}
            className="ml-1 min-w-[70px] cursor-pointer rounded-md px-1 py-0.5 text-center text-xs font-semibold transition-colors hover:bg-accent md:hidden"
            title="Tap to zoom out"
          >
            {view === "week"
              ? format(visibleDate, "MMM yyyy")
              : view === "month"
              ? format(visibleDate, "MMM yyyy")
              : view === "year"
              ? format(visibleDate, "yyyy")
              : format(visibleDate, "MMM d")}
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Undo — hidden on mobile (use ⌘Z or More menu) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onUndo}
            aria-label="Undo"
            title="Undo (last action)"
            disabled={!canUndo}
            className={`hidden sm:inline-flex ${!canUndo ? "opacity-40" : ""}`}
          >
            <Undo2 className="size-4" />
          </Button>

          {/* Search (cmd-k) — hidden on mobile, accessible via More menu */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSearch}
            aria-label="Search events"
            title="Search (⌘K)"
            className="hidden sm:inline-flex"
          >
            <Search className="size-4" />
          </Button>

          {/* Insights — hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenInsights}
            aria-label="Week insights"
            title="Week insights"
            className="hidden sm:inline-flex"
          >
            <BarChart3 className="size-4" />
          </Button>

          {/* Free-slot finder — hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenFreeSlot}
            aria-label="Find a free slot"
            title="Find a free slot"
            className="hidden sm:inline-flex"
          >
            <CalendarSearch className="size-4" />
          </Button>

          {/* Settings — hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="hidden sm:inline-flex"
          >
            <Settings className="size-4" />
          </Button>

          {/* Day/Week/Month/Year/List segmented toggle */}
          <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            <SegBtn active={view === "day"} onClick={() => onViewChange("day")}>
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">Day</span>
            </SegBtn>
            {/* Week hidden on mobile — not enough space for 7 columns on a phone */}
            <SegBtn active={view === "week"} onClick={() => onViewChange("week")} className="hidden sm:block">
              <span>Week</span>
            </SegBtn>
            <SegBtn active={view === "month"} onClick={() => onViewChange("month")}>
              <span className="sm:hidden">M</span>
              <span className="hidden sm:inline">Month</span>
            </SegBtn>
            <SegBtn active={view === "year"} onClick={() => onViewChange("year")} className="hidden sm:block">
              <span>Year</span>
            </SegBtn>
            <SegBtn active={view === "agenda"} onClick={() => onViewChange("agenda")} className="hidden sm:block">
              <span>List</span>
            </SegBtn>
          </div>

          {/* Auto-optimize — hidden on mobile (accessible via More) */}
          <Button
            variant="default"
            size="sm"
            onClick={onAutoOptimize}
            className="hidden gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:inline-flex"
          >
            <Sparkles className="size-3.5" />
            Auto-optimize
          </Button>

          {/* Calendars — hidden on mobile */}
          <Popover open={calendarsOpen} onOpenChange={setCalendarsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex">
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
            className="hidden sm:inline-flex"
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
            className="hidden sm:inline-flex"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          {/* Netlify Identity login/account */}
          <NetlifyIdentityButton />

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Mobile-only quick actions (hidden buttons' equivalents) */}
              <DropdownMenuItem onClick={onUndo} disabled={!canUndo} className="sm:hidden">
                <Undo2 className="size-4" />
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSearch} className="sm:hidden">
                <Search className="size-4" />
                Search events
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenInsights} className="sm:hidden">
                <BarChart3 className="size-4" />
                Week insights
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenFreeSlot} className="sm:hidden">
                <CalendarSearch className="size-4" />
                Find a free slot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSettings} className="sm:hidden">
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem
                onClick={() =>
                  window.open("/api/ical", "_blank")
                }
              >
                <Download className="size-4" />
                Export as .ics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenImport}>
                <Upload className="size-4" />
                Import .ics file
              </DropdownMenuItem>
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
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

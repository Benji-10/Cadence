"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addWeeks,
  addMonths,
  differenceInMinutes,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { toast } from "sonner";
import type { CalendarEvent, ReorderResult } from "@/lib/types";
import {
  useBootstrap,
  useCalendars,
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useReorder,
  useReseed,
  useUpdateEvent,
} from "@/hooks/use-calendar-data";
import { notifications } from "@/lib/notifications";
import { validateWindow, expandAllRecurrence } from "@/lib/scheduler";
import { useSettings } from "@/lib/settings-store";
import { Toolbar } from "./toolbar";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { MonthView } from "./month-view";
import { AgendaView } from "./agenda-view";
import { Sidebar } from "./sidebar";
import { EditSheet, type EditSheetState } from "./edit-sheet";
import { ReorderPreview } from "./reorder-preview";
import { SearchPalette } from "./search-palette";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { InsightsDialog } from "./insights-dialog";
import { ImportDialog } from "./import-dialog";
import { SettingsDialog } from "./settings-dialog";
import { FreeSlotDialog } from "./free-slot-dialog";
import { QuickActions } from "./quick-actions";
import { YearView } from "./year-view";
import {
  CalendarVisibilityContext,
  type VisibilityCtx,
} from "./visibility-context";
import { HOUR_HEIGHT, splitOvernightEvents } from "@/lib/calendar-ui";
import { useUndo } from "@/lib/undo-store";
import { api } from "@/lib/api-client";

type View = "day" | "week" | "month" | "year" | "agenda";

export function CalendarApp() {
  // Settings (must be before state that depends on it).
  const settings = useSettings();
  const weekStartsOn = settings.weekStartsOn;
  const undoStack = useUndo();

  // View state
  // Mobile defaults to Day view (iOS shows one day at a time on phone).
  // Week view is not shown on mobile — there isn't enough horizontal space.
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "day" : "week"
  );
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: weekStartsOn as 0 | 1 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() =>
    startOfDay(new Date())
  );
  const [monthDate, setMonthDate] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [yearDate, setYearDate] = useState<Date>(() => new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [freeSlotOpen, setFreeSlotOpen] = useState(false);
  const [quickActionEvent, setQuickActionEvent] = useState<CalendarEvent | null>(null);

  // Edit sheet + reorder preview
  const [editState, setEditState] = useState<EditSheetState | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderResult, setReorderResult] = useState<ReorderResult | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);

  // Calendar visibility
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  // Notification permission
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // Refs
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ---- Data ----
  const bootstrap = useBootstrap();
  const calendarsQ = useCalendars();
  const updateMut = useUpdateEvent();
  const reorderMut = useReorder();
  const reseedMut = useReseed();
  const deleteMut = useDeleteEvent();
  const createMut = useCreateEvent();

  // Visible range. Week/day views fetch the current week; month view fetches
  // the whole month grid (with leading/trailing days) so its cells are populated.
  const range = useMemo(() => {
    if (view === "year") {
      const from = new Date(yearDate.getFullYear(), 0, 1);
      const to = new Date(yearDate.getFullYear() + 1, 0, 1);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (view === "month") {
      const mStart = startOfMonth(monthDate);
      const from = startOfWeek(mStart, { weekStartsOn: weekStartsOn as 0 | 1 });
      const to = endOfWeek(endOfMonth(monthDate), { weekStartsOn: weekStartsOn as 0 | 1 });
      return { from: from.toISOString(), to: addDays(to, 1).toISOString() };
    }
    const from = weekStart.toISOString();
    const to = addWeeks(weekStart, 1).toISOString();
    return { from, to };
  }, [view, weekStart, monthDate, yearDate]);

  const eventsQ = useEvents(range);
  const rawEvents: CalendarEvent[] = eventsQ.data?.events ?? [];
  // Expand recurring events into concrete occurrences within the visible range
  // so the grid shows each repeat. One-off events pass through unchanged.
  // Then split any overnight events at midnight so each chunk renders within a
  // single day column (mirrors iOS Calendar — no blocks extending past 24h).
  const events: CalendarEvent[] = useMemo(
    () => splitOvernightEvents(expandAllRecurrence(rawEvents, range.from, range.to)),
    [rawEvents, range.from, range.to]
  );
  const calendars = calendarsQ.data?.calendars ?? [];
  const calendarsById = useMemo(
    () => Object.fromEntries(calendars.map((c) => [c.id, c])),
    [calendars]
  );

  const hiddenCalendarIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of calendars) {
      if (visibility[c.id] === false) s.add(c.id);
    }
    return s;
  }, [visibility, calendars]);

  // Default calendar id (first visible, or first overall)
  const defaultCalendarId = useMemo(() => {
    // Prefer the user's configured default (from Settings), if it's still
    // visible; otherwise fall back to the first visible calendar.
    if (
      settings.defaultCalendarId &&
      !hiddenCalendarIds.has(settings.defaultCalendarId)
    ) {
      return settings.defaultCalendarId;
    }
    return (
      calendars.find((c) => !hiddenCalendarIds.has(c.id))?.id ?? calendars[0]?.id
    );
  }, [calendars, hiddenCalendarIds, settings.defaultCalendarId]);

  // ---- Bootstrap on mount ----
  useEffect(() => {
    bootstrap.mutateAsync().catch(() => {
      /* surfaced by react-query */
    });
  }, []);

  // Default visibility when calendars load.
  useEffect(() => {
    setVisibility((cur) => {
      const next: Record<string, boolean> = {};
      for (const c of calendars) {
        next[c.id] = cur[c.id] ?? true;
      }
      return next;
    });
  }, [calendars]);

  // Auto-scroll to ~current time on first load / view switch (week/day only).
  // Respects the user's "auto-scroll to now" setting.
  useEffect(() => {
    if (view === "month") return;
    if (!settings.autoScrollToNow) return;
    if (!scrollRef.current) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const top = Math.max(0, (mins / 60) * HOUR_HEIGHT - 120);
    scrollRef.current.scrollTop = top;
  }, [view, weekStart, monthDate, settings.autoScrollToNow]);

  // ---- Notifications wiring ----
  useEffect(() => {
    notifications.setEvents(events);
    if (!bootstrap.isPending) notifications.start();
  }, [events, bootstrap.isPending]);

  useEffect(() => {
    notifications.setAlertCallback((eventId) => {
      const ev = events.find((e) => e.id === eventId);
      if (ev) toast.info(`Heads up: ${ev.title} starts soon.`);
    });
  }, [events]);

  // Keep notification permission in sync if it changes elsewhere.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const id = setInterval(() => {
      if (Notification.permission !== notifPerm) {
        setNotifPerm(Notification.permission);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [notifPerm]);

  const handleEnableNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") {
      toast.error("Notifications aren't supported here.");
      return;
    }
    if (Notification.permission === "granted") {
      toast.success("Notifications are on.");
      return;
    }
    const granted = await notifications.requestPermission();
    setNotifPerm(Notification.permission);
    if (granted) toast.success("Notifications on");
    else toast.error("Couldn't enable notifications — blocked by browser.");
  }, []);

  // ---- Toolbar callbacks ----
  const handlePrev = () => {
    if (view === "week") setWeekStart((d) => addWeeks(d, -1));
    else if (view === "month") setMonthDate((d) => addMonths(d, -1));
    else if (view === "year") setYearDate((d) => new Date(d.getFullYear() - 1, 0, 1));
    else setSelectedDay((d) => addDays(d, -1));
  };
  const handleNext = () => {
    if (view === "week") setWeekStart((d) => addWeeks(d, 1));
    else if (view === "month") setMonthDate((d) => addMonths(d, 1));
    else if (view === "year") setYearDate((d) => new Date(d.getFullYear() + 1, 0, 1));
    else setSelectedDay((d) => addDays(d, 1));
  };
  const handleToday = () => {
    const now = new Date();
    setWeekStart(startOfWeek(now, { weekStartsOn: weekStartsOn as 0 | 1 }));
    setSelectedDay(startOfDay(now));
    setMonthDate(startOfMonth(now));
    setYearDate(now);
  };

  const handleViewChange = (v: View) => {
    setView(v);
    if (v === "day") {
      const inWeek =
        parseISO(range.from) <= selectedDay && selectedDay < parseISO(range.to);
      if (!inWeek) setSelectedDay(startOfDay(new Date()));
    }
    if (v === "month") setMonthDate(startOfMonth(selectedDay));
    if (v === "year") setYearDate(selectedDay);
  };

  // Pick a day from the month grid → drill into Day view on that date.
  const handlePickDay = (day: Date) => {
    setSelectedDay(startOfDay(day));
    setWeekStart(startOfWeek(day, { weekStartsOn: weekStartsOn as 0 | 1 }));
    setView("day");
  };

  // Pick a month from the year grid → drill into Month view.
  const handlePickMonth = (monthDate: Date) => {
    setMonthDate(monthDate);
    setView("month");
  };

  // Click the month/year label in the toolbar to zoom out one level:
  // Day → Month, Month → Year.
  const handleLabelClick = () => {
    if (view === "day" || view === "week") {
      setMonthDate(startOfMonth(selectedDay));
      setView("month");
    } else if (view === "month") {
      setYearDate(monthDate);
      setView("year");
    }
  };

  const handleReseed = async () => {
    try {
      await reseedMut.mutateAsync();
      toast.success("Reset to sample schedule.");
    } catch (e) {
      toast.error("Couldn't reset", { description: String(e) });
    }
  };

  // ---- Auto-optimize ----
  const handleAutoOptimize = async () => {
    setReorderLoading(true);
    setReorderOpen(true);
    try {
      const res = await reorderMut.mutateAsync({
        mode: "week",
        rangeStart: range.from,
        rangeEnd: range.to,
        events,
      });
      setReorderResult(res);
      if (res.changes.length === 0) {
        toast.success("Nothing to optimize — your week is already tidy.");
      }
    } catch (e) {
      toast.error("Couldn't optimize", { description: String(e) });
      setReorderOpen(false);
    } finally {
      setReorderLoading(false);
    }
  };

  // ---- Move (drag) ----
  // Manual moves ALLOW overlap with fixed events (the user explicitly dragged
  // it there — e.g. homework over a lecture). Conflicting flexible tasks on
  // the SAME day are auto-bumped; other days are left untouched.
  const handleMove = useCallback(
    async (event: CalendarEvent, newStart: string, newEnd: string) => {
      // The event from the grid may be a split chunk (#night) or recurrence
      // occurrence (#occ). Strip the suffix to get the real DB id.
      const realId = event.id.split("#")[0];
      const newStartDate = new Date(newStart);
      // Constrain auto-bump to the same day as the new start.
      const dayStart = new Date(newStartDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      // Snapshot pre-move state for undo (the moved event + any that will be bumped).
      const willBeBumped = events.filter(
        (e) =>
          e.id !== realId &&
          e.flexibility !== "fixed" &&
          parseISO(e.start) < new Date(newEnd) &&
          parseISO(e.end) > new Date(newStart) &&
          !(e.allowOverlap && event.allowOverlap)
      );
      undoStack.push({
        label: `Move "${event.title}"`,
        events: [
          { id: realId, start: event.start, end: event.end },
          ...willBeBumped.map((e) => ({
            id: e.id.split("#")[0],
            start: e.start,
            end: e.end,
          })),
        ],
      });

      // Check for fixed-event overlaps so we can warn (but still allow).
      const validation = validateWindow(event, newStart, newEnd, events);

      try {
        const res = await reorderMut.mutateAsync({
          mode: "around",
          anchor: { ...event, id: realId },
          newStart,
          newEnd,
          events,
          rangeStart: dayStart.toISOString(),
          rangeEnd: dayEnd.toISOString(),
        });
        const updates: { id: string; patch: Partial<CalendarEvent> }[] = [
          { id: realId, patch: { start: newStart, end: newEnd } },
          ...res.changes.map((c) => ({
            id: c.eventId.split("#")[0],
            patch: { start: c.toStart, end: c.toEnd },
          })),
        ];
        const seen = new Set<string>();
        const unique = updates.filter((u) =>
          seen.has(u.id) ? false : (seen.add(u.id), true)
        );
        await Promise.all(unique.map((u) => updateMut.mutateAsync(u)));
        const movedCount = unique.length - 1;
        if (!validation.valid) {
          toast.warning(
            `Moved "${event.title}" onto a fixed event — check for conflicts.`
          );
        } else {
          toast.success(
            movedCount > 0
              ? `Moved "${event.title}" — also bumped ${movedCount} task${
                  movedCount > 1 ? "s" : ""
                } on the same day.`
              : `Moved "${event.title}".`
          );
        }
        if (res.notes.length > 0) {
          toast.info(res.notes[0], { duration: 6000 });
        }
      } catch (e) {
        toast.error("Couldn't move", { description: String(e) });
      }
    },
    [events, range, reorderMut, updateMut]
  );

  const handleBlockedMove = useCallback((event: CalendarEvent) => {
    // No longer blocked — fixed events are draggable. Kept for API compat.
    void event;
  }, []);

  // ---- Undo ----
  const handleUndo = useCallback(async () => {
    const entry = undoStack.pop();
    if (!entry) {
      toast.error("Nothing to undo.");
      return;
    }
    try {
      await api.bulkUpdate({
        updates: entry.events.map((e) => ({
          id: e.id,
          start: e.start,
          end: e.end,
        })),
      });
      toast.success(`Undid: ${entry.label}`);
    } catch (e) {
      toast.error("Couldn't undo", { description: String(e) });
    }
  }, [undoStack]);

  // Jump to an event from the search palette: switch to Day view on its date
  // and open the edit sheet so the user lands right on it.
  const handleJumpToEvent = useCallback((event: CalendarEvent) => {
    const start = parseISO(event.start);
    setSelectedDay(startOfDay(start));
    setWeekStart(startOfWeek(start, { weekStartsOn: weekStartsOn as 0 | 1 }));
    setMonthDate(startOfMonth(start));
    setView("day");
    setEditState({ mode: "edit", event });
    setEditOpen(true);
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/contenteditable.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) {
        // still allow Cmd/Ctrl+K for search + Cmd/Ctrl+Z for undo from anywhere
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setSearchOpen(true);
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      switch (e.key.toLowerCase()) {
        case "t":
          handleToday();
          break;
        case "j":
        case "arrowleft":
          handlePrev();
          break;
        case "k":
        case "arrowright":
          handleNext();
          break;
        case "d":
          setView("day");
          break;
        case "w":
          setView("week");
          break;
        case "m":
          setView("month");
          break;
        case "y":
          setView("year");
          break;
        case "a":
          setView("agenda");
          break;
        case "n": {
          const now = new Date();
          const start = new Date(now);
          start.setMinutes(0, 0, 0);
          const end = new Date(start.getTime() + 60 * 60_000);
          setEditState({
            mode: "create",
            defaults: {
              start: start.toISOString(),
              end: end.toISOString(),
              calendarId: defaultCalendarId,
            },
          });
          setEditOpen(true);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [defaultCalendarId]); // handlers are stable enough; re-binding on defaultCalendarId change is fine

  // ---- Resize ----
  const handleResize = useCallback(
    async (event: CalendarEvent, newStart: string, newEnd: string) => {
      try {
        await updateMut.mutateAsync({
          id: event.id,
          patch: { start: newStart, end: newEnd },
        });
        toast.success(`Resized "${event.title}".`);
      } catch (e) {
        toast.error("Couldn't resize", { description: String(e) });
      }
    },
    [updateMut]
  );

  // ---- Create / Edit ----
  const handleCreate = (defaults: {
    start: string;
    end: string;
    calendarId?: string;
  }) => {
    setEditState({ mode: "create", defaults });
    setEditOpen(true);
  };
  const handleSelect = (event: CalendarEvent) => {
    setEditState({ mode: "edit", event });
    setEditOpen(true);
  };

  // New-event from the sidebar "New event" button: default to the next whole
  // hour on the currently-selected day, 1h duration.
  const handleNewEvent = useCallback(() => {
    const now = new Date();
    const start = view === "month" ? new Date(selectedDay) : new Date(now);
    if (view !== "month") {
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
    } else {
      start.setHours(now.getHours() + 1, 0, 0, 0);
    }
    const end = new Date(
      start.getTime() + settings.defaultEventDurationMins * 60_000
    );
    setEditState({
      mode: "create",
      defaults: {
        start: start.toISOString(),
        end: end.toISOString(),
        calendarId: defaultCalendarId,
      },
    });
    setEditOpen(true);
  }, [view, selectedDay, defaultCalendarId, settings.defaultEventDurationMins]);

  // ---- Sticky footer: next event ----
  const nextEvent = useMemo(() => {
    const now = Date.now();
    return events
      .filter(
        (e) =>
          parseISO(e.end).getTime() > now &&
          !hiddenCalendarIds.has(e.calendarId)
      )
      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())[0];
  }, [events, hiddenCalendarIds]);

  // Count of events remaining today (for the footer's left badge).
  const todayRemaining = useMemo(() => {
    const now = Date.now();
    const todayStr = new Date().toDateString();
    return events.filter(
      (e) =>
        !hiddenCalendarIds.has(e.calendarId) &&
        parseISO(e.end).getTime() > now &&
        new Date(parseISO(e.start)).toDateString() === todayStr
    ).length;
  }, [events, hiddenCalendarIds]);

  const nextLabel = useMemo(() => {
    if (!nextEvent) return "Nothing upcoming";
    const start = parseISO(nextEvent.start);
    const mins = differenceInMinutes(start, new Date());
    if (mins < 1) return `Starting now: ${nextEvent.title}`;
    if (mins < 60) return `Next: ${nextEvent.title} in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `Next: ${nextEvent.title} in ${h}h${m > 0 ? ` ${m}m` : ""}`;
  }, [nextEvent]);

  const visibilityCtx: VisibilityCtx = useMemo(
    () => ({
      visibility,
      toggle: (id) =>
        setVisibility((cur) => ({ ...cur, [id]: !(cur[id] ?? true) })),
    }),
    [visibility]
  );

  const visibleDate =
    view === "week"
      ? weekStart
      : view === "month"
      ? monthDate
      : view === "year"
      ? yearDate
      : selectedDay;

  return (
    <CalendarVisibilityContext.Provider value={visibilityCtx}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <Toolbar
          visibleDate={visibleDate}
          view={view}
          onViewChange={handleViewChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onAutoOptimize={handleAutoOptimize}
          onReseed={handleReseed}
          notificationPermission={notifPerm}
          onEnableNotifications={handleEnableNotifications}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenInsights={() => setInsightsOpen(true)}
          onOpenImport={() => setImportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenFreeSlot={() => setFreeSlotOpen(true)}
          onUndo={handleUndo}
          canUndo={undoStack.stack.length > 0}
          onLabelClick={handleLabelClick}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar
            selectedDay={selectedDay}
            events={events}
            calendars={calendars}
            onSelectDay={handlePickDay}
            onNewEvent={handleNewEvent}
          />
          <main className="min-h-0 flex-1 overflow-hidden">
          {view === "week" ? (
            <WeekView
              weekStart={weekStart}
              events={events}
              calendarsById={calendarsById}
              hiddenCalendarIds={hiddenCalendarIds}
              selectedEventId={
                editState?.mode === "edit" ? editState.event?.id : undefined
              }
              onSelect={handleSelect}
              onCreate={handleCreate}
              onMoveEvent={handleMove}
              onResizeEvent={handleResize}
              onBlockedMove={handleBlockedMove}
              defaultCalendarId={defaultCalendarId}
              scrollContainerRef={scrollRef}
              onLongPress={setQuickActionEvent}
            />
          ) : view === "month" ? (
            <MonthView
              monthDate={monthDate}
              events={events}
              calendarsById={calendarsById}
              hiddenCalendarIds={hiddenCalendarIds}
              onSelect={handleSelect}
              onCreate={handleCreate}
              onPickDay={handlePickDay}
              defaultCalendarId={defaultCalendarId}
            />
          ) : view === "year" ? (
            <YearView
              yearDate={yearDate}
              events={events}
              onSelectMonth={handlePickMonth}
            />
          ) : view === "agenda" ? (
            <AgendaView
              rangeStart={parseISO(range.from)}
              rangeEnd={parseISO(range.to)}
              events={events}
              calendarsById={calendarsById}
              hiddenCalendarIds={hiddenCalendarIds}
              onSelect={handleSelect}
              onPickDay={handlePickDay}
            />
          ) : (
            <DayView
              day={selectedDay}
              events={events}
              calendarsById={calendarsById}
              hiddenCalendarIds={hiddenCalendarIds}
              selectedEventId={
                editState?.mode === "edit" ? editState.event?.id : undefined
              }
              onSelect={handleSelect}
              onCreate={handleCreate}
              onMoveEvent={handleMove}
              onResizeEvent={handleResize}
              onBlockedMove={handleBlockedMove}
              defaultCalendarId={defaultCalendarId}
              scrollContainerRef={scrollRef}
              onPrevDay={() => setSelectedDay((d) => addDays(d, -1))}
              onNextDay={() => setSelectedDay((d) => addDays(d, 1))}
              onLongPress={setQuickActionEvent}
            />
          )}
          </main>
        </div>

        {/* Sticky footer */}
        <footer
          className="glass safe-bottom mt-auto flex h-10 items-center justify-between gap-3 border-t border-border bg-background/90 px-3 text-xs text-muted-foreground sm:px-4"
          role="contentinfo"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            <span className="truncate">{nextLabel}</span>
            {todayRemaining > 0 && (
              <span className="hidden shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                {todayRemaining} today
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">
              {view === "week"
                ? `Week of ${format(weekStart, "d MMM")}`
                : view === "month"
                ? format(monthDate, "MMMM yyyy")
                : view === "year"
                ? format(yearDate, "yyyy")
                : view === "agenda"
                ? `Agenda · ${format(weekStart, "d MMM")}`
                : format(selectedDay, "EEE d MMM")}
            </span>
            <span className="flex items-center gap-1">
              <span
                className={
                  "size-1.5 rounded-full " +
                  (notifPerm === "granted"
                    ? "bg-emerald-500"
                    : notifPerm === "denied"
                    ? "bg-muted-foreground/40"
                    : "bg-amber-500")
                }
                aria-hidden
              />
              <span className="hidden sm:inline">
                {notifPerm === "granted"
                  ? "live"
                  : notifPerm === "denied"
                  ? "muted"
                  : "alerts off"}
              </span>
            </span>
          </div>
        </footer>

        {/* Edit sheet */}
        <EditSheet
          state={editState}
          open={editOpen}
          onOpenChange={setEditOpen}
          rangeStart={range.from}
          rangeEnd={range.to}
          events={events}
          defaultCalendarId={defaultCalendarId}
        />

        {/* Auto-optimize preview */}
        <ReorderPreview
          open={reorderOpen}
          onOpenChange={setReorderOpen}
          result={reorderResult}
          events={events}
          loading={reorderLoading}
        />

        {/* Search command palette (Cmd/Ctrl+K or /) */}
        <SearchPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          calendarsById={calendarsById}
          onSelect={handleJumpToEvent}
        />

        {/* Keyboard shortcuts help (? or via More menu) */}
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

        {/* Week insights */}
        <InsightsDialog
          open={insightsOpen}
          onOpenChange={setInsightsOpen}
          events={events}
          rangeStart={range.from}
          rangeEnd={range.to}
        />

        {/* iCal import */}
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

        {/* Settings */}
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

        {/* Free-slot finder */}
        <FreeSlotDialog
          open={freeSlotOpen}
          onOpenChange={setFreeSlotOpen}
          events={events}
          rangeStart={range.from}
          rangeEnd={range.to}
          onPick={(start, end) => {
            setEditState({
              mode: "create",
              defaults: { start, end, calendarId: defaultCalendarId },
            });
            setEditOpen(true);
          }}
        />

        {/* Quick actions popover (long-press an event on mobile) */}
        <QuickActions
          event={quickActionEvent}
          open={!!quickActionEvent}
          onOpenChange={(v) => !v && setQuickActionEvent(null)}
          onEdit={(ev) => handleSelect(ev)}
          onDelete={(ev) => {
            const realId = ev.id.split("#")[0];
            deleteMut.mutateAsync(realId).then(() => toast.success("Deleted"));
          }}
          onDuplicate={(ev) => {
            // Duplicate one day later
            const startMs = parseISO(ev.start).getTime();
            const dur = parseISO(ev.end).getTime() - startMs;
            const newStart = new Date(startMs + 24 * 60 * 60 * 1000);
            createMut.mutateAsync({
              title: ev.title,
              start: newStart.toISOString(),
              end: new Date(newStart.getTime() + dur).toISOString(),
              allDay: ev.allDay,
              calendarId: ev.calendarId,
              alerts: ev.alerts,
            }).then(() => toast.success("Duplicated"));
          }}
          onMoveMode={() => {
            toast.info("Drag the event to move it.");
          }}
        />
      </div>
    </CalendarVisibilityContext.Provider>
  );
}

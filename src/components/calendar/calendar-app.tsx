"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { toast } from "sonner";
import type { CalendarEvent, ReorderResult } from "@/lib/types";
import {
  useBootstrap,
  useCalendars,
  useEvents,
  useReorder,
  useReseed,
  useUpdateEvent,
} from "@/hooks/use-calendar-data";
import { notifications } from "@/lib/notifications";
import { validateWindow } from "@/lib/scheduler";
import { startOfWeek as startOfWeekMonday } from "@/lib/scheduler/time";
import { Toolbar } from "./toolbar";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { EditSheet, type EditSheetState } from "./edit-sheet";
import { ReorderPreview } from "./reorder-preview";
import {
  CalendarVisibilityContext,
  type VisibilityCtx,
} from "./visibility-context";
import { HOUR_HEIGHT } from "@/lib/calendar-ui";

type View = "day" | "week";

export function CalendarApp() {
  // View state
  const [view, setView] = useState<View>("week");
  const [weekStart, setWeekStart] = useState<Date>(() =>
    new Date(startOfWeekMonday(new Date().toISOString()))
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() =>
    startOfDay(new Date())
  );

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

  // Visible range = current week (Mon 00:00 → next Mon 00:00). We fetch the
  // whole week even in day view so reorder/next-event has full context.
  const range = useMemo(() => {
    const from = weekStart.toISOString();
    const to = addWeeks(weekStart, 1).toISOString();
    return { from, to };
  }, [weekStart]);

  const eventsQ = useEvents(range);
  const events: CalendarEvent[] = eventsQ.data?.events ?? [];
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
    return (
      calendars.find((c) => !hiddenCalendarIds.has(c.id))?.id ?? calendars[0]?.id
    );
  }, [calendars, hiddenCalendarIds]);

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

  // Auto-scroll to ~current time on first load / view switch.
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const top = Math.max(0, (mins / 60) * HOUR_HEIGHT - 120);
    scrollRef.current.scrollTop = top;
  }, [view, weekStart]);

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
    else setSelectedDay((d) => addDays(d, -1));
  };
  const handleNext = () => {
    if (view === "week") setWeekStart((d) => addWeeks(d, 1));
    else setSelectedDay((d) => addDays(d, 1));
  };
  const handleToday = () => {
    const now = new Date();
    setWeekStart(new Date(startOfWeekMonday(now.toISOString())));
    setSelectedDay(startOfDay(now));
  };

  const handleViewChange = (v: View) => {
    setView(v);
    if (v === "day") {
      const inWeek =
        parseISO(range.from) <= selectedDay && selectedDay < parseISO(range.to);
      if (!inWeek) setSelectedDay(startOfDay(new Date()));
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
  const handleMove = useCallback(
    async (event: CalendarEvent, newStart: string, newEnd: string) => {
      const validation = validateWindow(event, newStart, newEnd, events);
      if (!validation.valid) {
        toast.error(
          "Can't move — " + (validation.reason ?? "overlaps a fixed event.")
        );
        return;
      }
      try {
        const res = await reorderMut.mutateAsync({
          mode: "around",
          anchor: event,
          newStart,
          newEnd,
          events,
          rangeStart: range.from,
          rangeEnd: range.to,
        });
        const updates: { id: string; patch: Partial<CalendarEvent> }[] = [
          { id: event.id, patch: { start: newStart, end: newEnd } },
          ...res.changes.map((c) => ({
            id: c.eventId,
            patch: { start: c.toStart, end: c.toEnd },
          })),
        ];
        const seen = new Set<string>();
        const unique = updates.filter((u) =>
          seen.has(u.id) ? false : (seen.add(u.id), true)
        );
        await Promise.all(unique.map((u) => updateMut.mutateAsync(u)));
        const movedCount = unique.length - 1;
        toast.success(
          movedCount > 0
            ? `Moved "${event.title}" — also bumped ${movedCount} task${
                movedCount > 1 ? "s" : ""
              }.`
            : `Moved "${event.title}".`
        );
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
    toast.error(`Can't move "${event.title}" — it's a fixed event.`);
  }, []);

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

  const visibleDate = view === "week" ? weekStart : selectedDay;

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
            />
          )}
        </main>

        {/* Sticky footer */}
        <footer
          className="glass mt-auto flex h-10 items-center justify-between gap-3 border-t border-border bg-background/90 px-3 text-xs text-muted-foreground sm:px-4"
          role="contentinfo"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            <span className="truncate">{nextLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">
              {view === "week"
                ? `Week of ${format(weekStart, "d MMM")}`
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
      </div>
    </CalendarVisibilityContext.Provider>
  );
}

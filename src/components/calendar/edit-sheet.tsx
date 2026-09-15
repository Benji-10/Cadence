"use client";

import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  differenceInMinutes,
  addMinutes,
} from "date-fns";
import { MapPin, Sparkles, Trash2, Wand2, Lock, GripVertical, Copy, Layers } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  inferMetaFromTitle,
  describeFlexibility,
} from "@/lib/scheduler";
import { categoryLabel, fmtDuration } from "@/lib/calendar-ui";
import type {
  Calendar,
  CalendarEvent,
  Flexibility,
  LocationType,
  RecurrenceRule,
} from "@/lib/types";
import {
  useCalendars,
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
  useSuggest,
} from "@/hooks/use-calendar-data";
import { useSettings } from "@/lib/settings-store";
import { useTemplates } from "@/lib/templates-store";
import { TemplatesBar } from "./templates-bar";
import { LocationAutocomplete } from "./location-autocomplete";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface EditSheetState {
  mode: "create" | "edit";
  event?: CalendarEvent;
  defaults?: { start: string; end: string; calendarId?: string };
}

interface EditSheetProps {
  state: EditSheetState | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rangeStart: string;
  rangeEnd: string;
  events: CalendarEvent[];
  defaultCalendarId?: string;
}

const COLOR_SWATCHES = [
  "#F59E0B", "#10B981", "#EF4444", "#06B6D4", "#22C55E", "#A855F7",
  "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#0EA5E9", "#6366F1",
  "#3B82F6", "#9CA3AF", "#D1D5DB",
];

const ALERT_PRESETS: { label: string; value: number }[] = [
  { label: "At start", value: 0 },
  { label: "5 min", value: -5 },
  { label: "10 min", value: -10 },
  { label: "15 min", value: -15 },
  { label: "30 min", value: -30 },
  { label: "1 hour", value: -60 },
  { label: "1 day", value: -60 * 24 },
];

const RECURRENCE_FREQS = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const PRIORITIES = [
  { value: "0", label: "None" },
  { value: "1", label: "Low" },
  { value: "5", label: "Medium" },
  { value: "9", label: "High" },
];

const FLEX_OPTIONS: { value: Flexibility; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "movable", label: "Movable" },
  { value: "flexible", label: "Flexible (splittable)" },
];

const LOC_TYPES: { value: LocationType; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "home", label: "Home" },
  { value: "campus", label: "Campus" },
  { value: "sports", label: "Sports centre" },
  { value: "out", label: "Out" },
];

const HOURS_15MIN = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return { value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
});

export function EditSheet({
  state,
  open,
  onOpenChange,
  rangeStart,
  rangeEnd,
  events,
  defaultCalendarId,
}: EditSheetProps) {
  const isMobile = useIsMobile();
  const sheetSide: "bottom" | "right" = isMobile ? "bottom" : "right";

  // Force a fresh form mount whenever the target event / create-defaults
  // change so initial useState values are read from the latest props.
  const formKey = useMemo(() => {
    if (state?.mode === "edit" && state.event) return `edit-${state.event.id}`;
    if (state?.mode === "create" && state.defaults) {
      return `create-${state.defaults.start}-${state.defaults.end}`;
    }
    return "blank";
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={sheetSide}
        className={cn(
          "gap-0 p-0",
          isMobile
            ? "h-[92vh] max-h-[92vh] rounded-t-2xl"
            : "w-full sm:max-w-md md:max-w-lg"
        )}
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-base">
            {state?.mode === "edit" ? "Edit event" : "New event"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {state?.mode === "edit"
              ? "Update or delete this calendar event."
              : "Create a new calendar event."}
          </SheetDescription>
        </SheetHeader>
        <EditForm
          key={formKey}
          state={state}
          onOpenChange={onOpenChange}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          events={events}
          defaultCalendarId={defaultCalendarId}
        />
      </SheetContent>
    </Sheet>
  );
}

interface EditFormProps {
  state: EditSheetState | null;
  onOpenChange: (open: boolean) => void;
  rangeStart: string;
  rangeEnd: string;
  events: CalendarEvent[];
  defaultCalendarId?: string;
}

function EditForm({
  state,
  onOpenChange,
  rangeStart,
  rangeEnd,
  events,
  defaultCalendarId,
}: EditFormProps) {
  const { data: calsData } = useCalendars();
  const calendars: Calendar[] = calsData?.calendars ?? [];
  const createMut = useCreateEvent();
  const updateMut = useUpdateEvent();
  const deleteMut = useDeleteEvent();
  const suggestMut = useSuggest();

  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const settingsAlerts = useSettings((s) => s.defaultAlerts);
  const addTemplate = useTemplates((s) => s.addTemplate);

  // Initialise from `state` synchronously (lazy useState initializers).
  const initial = useMemo(() => {
    if (state?.mode === "edit" && state.event) {
      const e = state.event;
      return {
        title: e.title,
        allDay: e.allDay,
        start: e.start,
        end: e.end,
        calendarId: e.calendarId,
        color: e.color ?? null,
        location: e.location ?? "",
        travelMins: e.travelMins ?? 0,
        alerts: e.alerts?.length ? e.alerts : settingsAlerts,
        freq: e.recurrence ? e.recurrence.freq : "none",
        interval: e.recurrence ? e.recurrence.interval : 1,
        until: e.recurrence?.until ?? null,
        priority: e.priority ?? 0,
        timezone: e.timezone ?? tz,
        notes: e.notes ?? "",
        flexibility: e.flexibility,
        minChunkMins: e.minChunkMins,
        allowOverlap: e.allowOverlap,
        locationType: e.locationType,
      };
    }
    const d = state?.defaults;
    const inferred = d?.start ? inferMetaFromTitle("") : inferMetaFromTitle("");
    const startIso = d?.start ?? new Date().toISOString();
    const endIso = d?.end ?? addMinutes(new Date(), 60).toISOString();
    return {
      title: "",
      allDay: false,
      start: startIso,
      end: endIso,
      calendarId: d?.calendarId ?? defaultCalendarId ?? calendars[0]?.id ?? "",
      color: null,
      location: "",
      travelMins: 0,
      alerts: settingsAlerts,
      freq: "none",
      interval: 1,
      until: null,
      priority: 0,
      timezone: tz,
      notes: "",
      flexibility: inferred.flexibility,
      minChunkMins: inferred.minChunkMins,
      allowOverlap: inferred.allowOverlap,
      locationType: inferred.locationType,
    };
  }, [state, tz, defaultCalendarId, calendars]);

  const [title, setTitle] = useState(initial.title);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [calendarId, setCalendarId] = useState(initial.calendarId);
  const [color, setColor] = useState<string | null>(initial.color);
  const [location, setLocation] = useState(initial.location);
  const [travelMins, setTravelMins] = useState(initial.travelMins);
  const [alerts, setAlerts] = useState<number[]>(initial.alerts);
  const [customAlert, setCustomAlert] = useState("");
  const [freq, setFreq] = useState(initial.freq);
  const [intervalN, setIntervalN] = useState(initial.interval);
  const [until, setUntil] = useState<string | null>(initial.until);
  const [priority, setPriority] = useState(initial.priority);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [notes, setNotes] = useState(initial.notes);
  const [flexibility, setFlexibility] = useState<Flexibility>(initial.flexibility);
  const [minChunkMins, setMinChunkMins] = useState(initial.minChunkMins);
  const [allowOverlap, setAllowOverlap] = useState(initial.allowOverlap);
  const [locationType, setLocationType] = useState<LocationType>(initial.locationType);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const inferred = useMemo(() => inferMetaFromTitle(title), [title]);
  const calendarsById = useMemo(
    () => Object.fromEntries(calendars.map((c) => [c.id, c])),
    [calendars]
  );

  const startDate = start ? parseISO(start) : new Date();
  const endDate = end ? parseISO(end) : new Date();
  const durationMins = differenceInMinutes(endDate, startDate);
  const endBeforeStart = durationMins < 0;

  const handleTitleChange = (v: string) => {
    setTitle(v);
    // In create mode, re-sync the inferred scheduling fields so the saved
    // event picks up the right flexibility/min-chunk for its title.
    if (state?.mode === "create" && v.trim()) {
      const inf = inferMetaFromTitle(v);
      setFlexibility(inf.flexibility);
      setMinChunkMins(inf.minChunkMins);
      setAllowOverlap(inf.allowOverlap);
      setLocationType(inf.locationType);
      if (!calendarId && inf.calendarKind) {
        const match = calendars.find((c) => c.kind === inf.calendarKind);
        if (match) setCalendarId(match.id);
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Give your event a title.");
      return;
    }
    if (endBeforeStart && !allDay) {
      toast.error("End time must be after start.");
      return;
    }
    if (!calendarId) {
      toast.error("Pick a calendar.");
      return;
    }
    const recurrence: RecurrenceRule | null =
      freq !== "none"
        ? {
            freq: freq as RecurrenceRule["freq"],
            interval: Math.max(1, intervalN || 1),
            until: until ?? undefined,
          }
        : null;
    const payload: Partial<CalendarEvent> & {
      title: string;
      start: string;
      end: string;
      calendarId: string;
    } = {
      title: title.trim(),
      start,
      end: allDay ? start : end,
      allDay,
      calendarId,
      location: location || null,
      travelMins,
      alerts,
      recurrence,
      priority,
      timezone,
      notes: notes || null,
      flexibility,
      minChunkMins,
      allowOverlap,
      locationType,
      color: color ?? null,
      category: inferred.category,
    };
    try {
      if (state?.mode === "edit" && state.event) {
        await updateMut.mutateAsync({ id: state.event.id, patch: payload });
        toast.success("Event updated");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Event added");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't save", { description: String(e) });
    }
  };

  const handleDelete = async () => {
    if (!state?.event) return;
    try {
      await deleteMut.mutateAsync(state.event.id);
      toast.success("Deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't delete", { description: String(e) });
    }
  };

  // Duplicate the current event one day later (same time). Keeps all the
  // intelligence metadata so the copy behaves the same way.
  const handleDuplicate = async () => {
    if (!state?.event) return;
    const ev = state.event;
    const startMs = parseISO(ev.start).getTime();
    const endMs = parseISO(ev.end).getTime();
    const dur = endMs - startMs;
    const newStart = new Date(startMs + 24 * 60 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + dur);
    try {
      const res = await createMut.mutateAsync({
        title: ev.title,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        allDay: ev.allDay,
        location: ev.location ?? undefined,
        notes: ev.notes ?? undefined,
        timezone: ev.timezone ?? undefined,
        calendarId: ev.calendarId,
        category: ev.category,
        flexibility: ev.flexibility,
        locationType: ev.locationType,
        minChunkMins: ev.minChunkMins,
        allowOverlap: ev.allowOverlap,
        priority: ev.priority,
        travelMins: ev.travelMins,
        color: ev.color ?? undefined,
        alerts: ev.alerts,
        recurrence: ev.recurrence ?? undefined,
      });
      toast.success("Duplicated to " + format(newStart, "EEE d MMM, HH:mm"));
      onOpenChange(false);
      void res;
    } catch (e) {
      toast.error("Couldn't duplicate", { description: String(e) });
    }
  };

  // Save the current event's title/duration/calendar/location as a reusable
  // quick-add template.
  const handleSaveAsTemplate = () => {
    if (!title.trim()) {
      toast.error("Type a title first.");
      return;
    }
    const dur = Math.max(
      15,
      Math.round(
        (parseISO(end).getTime() - parseISO(start).getTime()) / 60000
      )
    );
    addTemplate({
      title: title.trim(),
      durationMins: dur,
      calendarId,
      location: location || undefined,
      color,
      category: inferred.category,
      flexibility: inferred.flexibility,
      locationType: inferred.locationType,
    });
    toast.success(`Saved "${title.trim()}" as a template.`);
  };

  // Apply a template's fields to the current form.
  const applyTemplate = (t: {
    title: string;
    durationMins: number;
    calendarId?: string;
    location?: string;
    color?: string | null;
    category?: string;
    flexibility?: string;
    locationType?: string;
  }) => {
    setTitle(t.title);
    if (t.location !== undefined) setLocation(t.location);
    if (t.calendarId) setCalendarId(t.calendarId);
    if (t.color !== undefined) setColor(t.color);
    // Re-derive start/end: keep the current start, adjust end to the template duration.
    const startMs = parseISO(start).getTime();
    const newEnd = new Date(startMs + t.durationMins * 60000).toISOString();
    setEnd(newEnd);
    toast.success(`Applied "${t.title}" template.`);
  };

  const handleFindBestSlot = async () => {
    if (!title.trim()) {
      toast.error("Type a title first so I know what to schedule.");
      return;
    }
    const dur = Math.max(15, Math.round(durationMins));
    try {
      const res = await suggestMut.mutateAsync({
        task: { category: inferred.category, locationType, minChunkMins, flexibility },
        durationMins: dur,
        rangeStart,
        rangeEnd,
        aroundEvents: events,
      });
      if (!res.plan || res.plan.placements.length === 0) {
        toast.error("No free slot found for this task.");
        return;
      }
      const p = res.plan.placements[0];
      setStart(p.start);
      setEnd(p.end);
      toast.success(`Placed: ${res.plan.reason}`);
    } catch (e) {
      toast.error("Couldn't find a slot", { description: String(e) });
    }
  };

  const toggleAlert = (v: number) => {
    setAlerts((cur) =>
      cur.includes(v)
        ? cur.filter((a) => a !== v)
        : [...cur, v].sort((a, b) => a - b)
    );
  };
  const addCustomAlert = () => {
    const n = Number(customAlert);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid number of minutes.");
      return;
    }
    // Store as negative (minutes-before start) to match the notifications engine.
    toggleAlert(-n);
    setCustomAlert("");
  };

  return (
    <>
      <div className="cal-scroll flex-1 overflow-y-auto px-4 py-4">
        {/* Title */}
        <div className="mb-3">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Title"
            autoFocus={state?.mode === "create"}
            className="h-12 border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="gap-1 text-[11px] font-medium"
              style={{
                backgroundColor: inferred.color + "20",
                color: inferred.color,
              }}
            >
              {categoryLabel(inferred.category)} · {inferred.flexibility}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {describeFlexibility(inferred.flexibility)}
            </span>
          </div>
        </div>

        {/* All-day */}
        <Row label="All-day">
          <Switch checked={allDay} onCheckedChange={setAllDay} />
        </Row>
        <Separator className="my-2" />

        {/* Starts / Ends */}
        {!allDay && (
          <>
            <Row label="Starts">
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      {format(startDate, "EEE d MMM")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <DatePicker
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStart(mergeDate(d, startDate).toISOString())}
                    />
                  </PopoverContent>
                </Popover>
                <Select
                  value={format(startDate, "HH:mm")}
                  onValueChange={(v) => setStart(mergeTime(startDate, v).toISOString())}
                >
                  <SelectTrigger size="sm" className="h-7 w-[78px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS_15MIN.map((h) => (
                      <SelectItem key={h.value} value={h.value} className="text-xs">
                        {h.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Row>

            <Row label="Ends">
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      {format(endDate, "EEE d MMM")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <DatePicker
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEnd(mergeDate(d, endDate).toISOString())}
                    />
                  </PopoverContent>
                </Popover>
                <Select
                  value={format(endDate, "HH:mm")}
                  onValueChange={(v) => setEnd(mergeTime(endDate, v).toISOString())}
                >
                  <SelectTrigger size="sm" className="h-7 w-[78px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS_15MIN.map((h) => (
                      <SelectItem key={h.value} value={h.value} className="text-xs">
                        {h.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Row>

            <div className="mb-1 mt-1 flex items-center justify-between px-1 text-[11px]">
              <span
                className={cn(
                  endBeforeStart ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {endBeforeStart
                  ? "End is before start"
                  : `Duration: ${fmtDuration(start, end)}`}
              </span>
            </div>
          </>
        )}

        {allDay && (
          <Row label="Date">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  {format(startDate, "EEE d MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <DatePicker
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setStart(mergeDate(d, startDate).toISOString());
                    setEnd(mergeDate(d, startDate).toISOString());
                  }}
                />
              </PopoverContent>
            </Popover>
          </Row>
        )}

        <Separator className="my-2" />

        {/* Calendar */}
        <Row label="Calendar">
          <Select value={calendarId} onValueChange={setCalendarId}>
            <SelectTrigger size="sm" className="h-7 w-[160px] text-xs">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {calendars.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        {/* Color override */}
        <div className="mb-2 mt-1 px-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Color override
          </Label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {calendarsById[calendarId] && (
              <button
                onClick={() => setColor(null)}
                className={cn(
                  "size-5 rounded-full ring-2 ring-offset-1 ring-offset-background transition-transform hover:scale-110",
                  color === null ? "ring-foreground" : "ring-transparent"
                )}
                style={{ backgroundColor: calendarsById[calendarId].color }}
                aria-label="Use calendar color"
                title="Use calendar color"
              />
            )}
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-5 rounded-full ring-2 ring-offset-1 ring-offset-background transition-transform hover:scale-110",
                  color === c ? "ring-foreground" : "ring-transparent"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Use color ${c}`}
              />
            ))}
          </div>
        </div>

        <Separator className="my-2" />

        {/* Location */}
        <Row
          label="Location"
          icon={<MapPin className="size-3.5 text-muted-foreground" />}
        >
          <div className="w-[60%]">
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Search a place…"
            />
          </div>
        </Row>

        <Row label="Travel time (min)">
          <Input
            type="number"
            min={0}
            value={travelMins}
            onChange={(e) => setTravelMins(Math.max(0, Number(e.target.value) || 0))}
            className="h-7 w-20 text-xs"
          />
        </Row>

        <Separator className="my-2" />

        {/* Alerts */}
        <div className="mb-2 px-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Alerts
          </Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ALERT_PRESETS.map((a) => {
              const on = alerts.includes(a.value);
              return (
                <button
                  key={a.value}
                  onClick={() => toggleAlert(a.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Input
              type="number"
              min={0}
              value={customAlert}
              onChange={(e) => setCustomAlert(e.target.value)}
              placeholder="Custom (min before)"
              className="h-7 w-40 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addCustomAlert}
              className="h-7 text-xs"
            >
              Add
            </Button>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Overlap control — promoted out of advanced for visibility */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-start gap-2">
            <Layers className="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <div className="text-xs font-medium">Allow overlap with other events</div>
              <div className="text-[10px] text-muted-foreground">
                {allowOverlap
                  ? "This task can overlap same-location events (e.g. laundry while working)."
                  : "This task blocks others — conflicts will be highlighted."}
              </div>
            </div>
          </div>
          <Switch checked={allowOverlap} onCheckedChange={setAllowOverlap} />
        </div>

        {/* Repeat */}
        <Row label="Repeat">
          <Select value={freq} onValueChange={setFreq}>
            <SelectTrigger size="sm" className="h-7 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCE_FREQS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        {freq !== "none" && (
          <>
            <Row label="Every">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  value={intervalN}
                  onChange={(e) => setIntervalN(Math.max(1, Number(e.target.value) || 1))}
                  className="h-7 w-14 text-xs"
                />
                <span className="text-xs text-muted-foreground">
                  {freq === "daily"
                    ? "days"
                    : freq === "weekly"
                    ? "weeks"
                    : freq === "monthly"
                    ? "months"
                    : "years"}
                </span>
              </div>
            </Row>
            <Row label="Ends">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    {until ? format(parseISO(until), "d MMM yyyy") : "Never"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <DatePicker
                    mode="single"
                    selected={until ? parseISO(until) : undefined}
                    onSelect={(d) => setUntil(d ? d.toISOString() : null)}
                  />
                </PopoverContent>
              </Popover>
            </Row>
          </>
        )}

        {/* Priority */}
        <Row label="Priority">
          <Select
            value={String(priority)}
            onValueChange={(v) => setPriority(Number(v))}
          >
            <SelectTrigger size="sm" className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Time zone">
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-7 w-[60%] text-xs"
          />
        </Row>

        {/* Notes */}
        <div className="mb-2 mt-2 px-1">
          <Label className="text-[11px] font-medium text-muted-foreground">
            Notes
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else?"
            className="mt-1 min-h-[64px] text-xs"
          />
        </div>

        {/* Advanced */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-between px-1 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <Wand2 className="size-3.5" />
                Scheduling behaviour
              </span>
              <span className="text-[10px] text-muted-foreground">
                {advancedOpen ? "Hide" : "Show"}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 px-1">
            <Row
              label="Flexibility"
              icon={<Lock className="size-3.5 text-muted-foreground" />}
            >
              <Select
                value={flexibility}
                onValueChange={(v) => setFlexibility(v as Flexibility)}
              >
                <SelectTrigger size="sm" className="h-7 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLEX_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <p className="px-1 text-[11px] text-muted-foreground">
              {describeFlexibility(flexibility)}
            </p>
            {flexibility === "flexible" && (
              <Row label="Min chunk (min)">
                <Input
                  type="number"
                  min={15}
                  step={5}
                  value={minChunkMins}
                  onChange={(e) =>
                    setMinChunkMins(Math.max(15, Number(e.target.value) || 15))
                  }
                  className="h-7 w-20 text-xs"
                />
              </Row>
            )}
            <Row
              label="Allow overlap"
              icon={<GripVertical className="size-3.5 text-muted-foreground" />}
            >
              <Switch
                checked={allowOverlap}
                onCheckedChange={setAllowOverlap}
              />
            </Row>
            <Row label="Location type">
              <Select
                value={locationType}
                onValueChange={(v) => setLocationType(v as LocationType)}
              >
                <SelectTrigger size="sm" className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOC_TYPES.map((l) => (
                    <SelectItem key={l.value} value={l.value} className="text-xs">
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </CollapsibleContent>
        </Collapsible>

        {/* Find best slot */}
        {!allDay && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full gap-1.5"
            onClick={handleFindBestSlot}
            disabled={suggestMut.isPending}
          >
            <Sparkles className="size-3.5" />
            {suggestMut.isPending ? "Finding…" : "Find best slot"}
          </Button>
        )}

        {/* Quick-add templates (create mode only) */}
        {state?.mode === "create" && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Quick add
              </span>
              <button
                onClick={handleSaveAsTemplate}
                className="text-[11px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                disabled={!title.trim()}
              >
                + Save current as template
              </button>
            </div>
            <TemplatesBar onApply={applyTemplate} />
          </div>
        )}
      </div>

      <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border px-4 py-3">
        {state?.mode === "edit" && state.event ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={handleDuplicate}
              disabled={createMut.isPending}
            >
              <Copy className="size-3.5" />
              Duplicate
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &ldquo;{state.event.title}&rdquo; from
                  your calendar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={createMut.isPending || updateMut.isPending}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {state?.mode === "edit" ? "Done" : "Add event"}
        </Button>
      </SheetFooter>
    </>
  );
}

// ---- Row helper ----------------------------------------------------------
function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function mergeDate(date: Date, time: Date): Date {
  const d = new Date(time);
  d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return d;
}

function mergeTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

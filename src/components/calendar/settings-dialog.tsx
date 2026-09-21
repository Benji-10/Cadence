"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Bell, Calendar, Clock, Eye, BellRing, Radar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendars } from "@/hooks/use-calendar-data";
import { useMounted } from "@/hooks/use-mounted";
import { useSettings } from "@/lib/settings-store";
import { notifications } from "@/lib/notifications";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ALERT_PRESETS: { label: string; value: number }[] = [
  { label: "At start", value: 0 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { data: calData } = useCalendars();
  const calendars = calData?.calendars ?? [];
  const s = useSettings();
  // Avoid hydration mismatch: only render settings after mount so the
  // persisted values from localStorage are available.
  const mounted = useMounted();

  const toggleAlert = (v: number) => {
    const next = s.defaultAlerts.includes(v)
      ? s.defaultAlerts.filter((a) => a !== v)
      : [...s.defaultAlerts, v].sort((a, b) => a - b);
    s.setDefaultAlerts(next);
  };

  if (!mounted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-4 text-emerald-600" />
            Settings
          </DialogTitle>
          <DialogDescription>
            These preferences are saved to your device and apply across Cadence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Default calendar */}
          <section>
            <SectionLabel icon={<Calendar className="size-3.5" />} label="Default calendar" />
            <Select
              value={s.defaultCalendarId ?? "__none__"}
              onValueChange={(v) => s.setDefaultCalendarId(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Use first visible</SelectItem>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Default event duration */}
          <section>
            <SectionLabel icon={<Clock className="size-3.5" />} label="Default event duration" />
            <div className="flex gap-1">
              {[30, 60, 90, 120].map((m) => (
                <Button
                  key={m}
                  variant={s.defaultEventDurationMins === m ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => s.setDefaultEventDurationMins(m)}
                >
                  {m < 60 ? `${m}m` : `${m / 60}h`}
                </Button>
              ))}
            </div>
          </section>

          {/* Default alerts */}
          <section>
            <SectionLabel icon={<Bell className="size-3.5" />} label="Default alerts" />
            <div className="flex flex-wrap gap-1.5">
              {ALERT_PRESETS.map((a) => {
                const active = s.defaultAlerts.includes(a.value);
                return (
                  <button
                    key={a.value}
                    onClick={() => toggleAlert(a.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Week starts on */}
          <section>
            <SectionLabel label="Week starts on" />
            <div className="flex gap-1">
              <Button
                variant={s.weekStartsOn === 0 ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => s.setWeekStartsOn(0)}
              >
                Sunday
              </Button>
              <Button
                variant={s.weekStartsOn === 1 ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => s.setWeekStartsOn(1)}
              >
                Monday
              </Button>
            </div>
          </section>

          {/* Snap */}
          <section>
            <SectionLabel label="Drag/resize snap" />
            <div className="flex gap-1">
              {[15, 30, 60].map((m) => (
                <Button
                  key={m}
                  variant={s.snapMinutes === (m as 15 | 30 | 60) ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => s.setSnapMinutes(m as 15 | 30 | 60)}
                >
                  {m}m
                </Button>
              ))}
            </div>
          </section>

          {/* Toggles */}
          <section className="space-y-2.5">
            <ToggleRow
              icon={<Eye className="size-3.5" />}
              label="Show conflict badges"
              description="Highlight overlapping events on the grid"
              checked={s.showConflictBadges}
              onCheckedChange={s.setShowConflictBadges}
            />
            <ToggleRow
              icon={<Clock className="size-3.5" />}
              label="Auto-scroll to current time"
              description="Jump to now when the view changes"
              checked={s.autoScrollToNow}
              onCheckedChange={s.setAutoScrollToNow}
            />
          </section>

          {/* Notifications */}
          <section>
            <SectionLabel icon={<BellRing className="size-3.5" />} label="Notifications" />
            <div className="rounded-lg border border-border/60 bg-card p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Get alerts 30 min, 10 min, and when events start. Requires
                notification permission.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={async () => {
                    if (typeof Notification === "undefined") {
                      toast.error("Notifications not supported.");
                      return;
                    }
                    if (Notification.permission !== "granted") {
                      const granted = await notifications.requestPermission();
                      if (!granted) {
                        toast.error("Permission denied. Enable in iOS Settings → Safari → Notifications.");
                        return;
                      }
                      toast.success("Notifications enabled!");
                    } else {
                      toast.info("Notifications already enabled.");
                    }
                  }}
                >
                  <Bell className="size-3" />
                  {typeof Notification !== "undefined" && Notification.permission === "granted"
                    ? "Enabled ✓"
                    : "Enable notifications"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  disabled={typeof Notification === "undefined" || Notification.permission !== "granted"}
                  onClick={async () => {
                    await notifications.sendTest();
                    toast.success("Test notification sent — check your device!");
                  }}
                >
                  <BellRing className="size-3" />
                  Send test
                </Button>
              </div>
              {/* Preview which server-side alerts would fire right now.
                  Calls the dry-run debug route so the user can verify the
                  look-back + dedup logic is catching their events. */}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full gap-1.5 text-xs text-muted-foreground"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/debug/check-alerts?dryRun=1");
                    const data = await res.json();
                    const due = data.dueAlerts ?? [];
                    if (due.length === 0) {
                      toast.info("No alerts due right now", {
                        description: `Queried ${data.eventsQueried} event(s) in the 20-min-look-back / 45-min-look-ahead window.`,
                      });
                    } else {
                      const lines = due
                        .map((a: { title: string; fireAt: string }) => `• ${a.title} @ ${new Date(a.fireAt).toLocaleTimeString()}`)
                        .join("\n");
                      toast.success(`${due.length} alert(s) would fire now`, {
                        description: lines,
                        duration: 8000,
                      });
                    }
                  } catch {
                    toast.error("Couldn't check alerts.");
                  }
                }}
              >
                <Radar className="size-3" />
                Preview due alerts
              </Button>
            </div>
          </section>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              toast.success("Settings saved.");
              onOpenChange(false);
            }}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({
  icon,
  label,
}: {
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

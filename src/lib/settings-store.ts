"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// User preferences for the calendar. Persisted to localStorage so they survive
// reloads and PWA reinstalls. These drive defaults across the app (the default
// calendar for new events, the default alert offsets, theme handled by
// next-themes, week start, and time-to-day scroll behaviour).
export interface Settings {
  defaultCalendarId: string | null;
  defaultAlerts: number[]; // minutes-before, e.g. [-30, -10, 0]
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  snapMinutes: 15 | 30 | 60; // drag/resize snap
  autoScrollToNow: boolean;
  showConflictBadges: boolean;
  defaultEventDurationMins: number;
  setDefaultCalendarId: (id: string | null) => void;
  setDefaultAlerts: (alerts: number[]) => void;
  setWeekStartsOn: (v: 0 | 1) => void;
  setSnapMinutes: (v: 15 | 30 | 60) => void;
  setAutoScrollToNow: (v: boolean) => void;
  setShowConflictBadges: (v: boolean) => void;
  setDefaultEventDurationMins: (v: number) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      defaultCalendarId: null,
      defaultAlerts: [-30, -10, 0],
      weekStartsOn: 1,
      snapMinutes: 15,
      autoScrollToNow: true,
      showConflictBadges: true,
      defaultEventDurationMins: 60,
      setDefaultCalendarId: (id) => set({ defaultCalendarId: id }),
      setDefaultAlerts: (alerts) => set({ defaultAlerts: alerts }),
      setWeekStartsOn: (v) => set({ weekStartsOn: v }),
      setSnapMinutes: (v) => set({ snapMinutes: v }),
      setAutoScrollToNow: (v) => set({ autoScrollToNow: v }),
      setShowConflictBadges: (v) => set({ showConflictBadges: v }),
      setDefaultEventDurationMins: (v) => set({ defaultEventDurationMins: v }),
    }),
    { name: "cadence-settings" }
  )
);

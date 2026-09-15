"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Calendar, CalendarEvent, ReorderResult } from "@/lib/types";

export interface DateRange {
  from: string;
  to: string;
}

// ---- Bootstrap -----------------------------------------------------------
export function useBootstrap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.bootstrap(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendars"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

// ---- Calendars -----------------------------------------------------------
export function useCalendars() {
  return useQuery<{ calendars: Calendar[] }>({
    queryKey: ["calendars"],
    queryFn: () => api.listCalendars(),
  });
}

export function useCreateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string; kind?: string }) =>
      api.createCalendar(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendars"] });
    },
  });
}

// ---- Events --------------------------------------------------------------
export function useEvents(range: DateRange | null) {
  return useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["events", range?.from, range?.to],
    queryFn: () => api.listEvents(range!.from, range!.to),
    enabled: !!range,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Partial<CalendarEvent> & {
        title: string;
        start: string;
        end: string;
        calendarId: string;
      }
    ) => api.createEvent(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["calendars"] });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CalendarEvent> }) =>
      api.updateEvent(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useBulkUpdateEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; patch: Partial<CalendarEvent> }[]) => {
      const results: { id: string; patch: Partial<CalendarEvent>; ok: boolean }[] = [];
      for (const { id, patch } of updates) {
        try {
          await api.updateEvent(id, patch);
          results.push({ id, patch, ok: true });
        } catch {
          results.push({ id, patch, ok: false });
        }
      }
      return results;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

// ---- Reorder (auto-optimize) ---------------------------------------------
export function useReorder() {
  // This is a one-shot call (not a query cache). We expose it as a mutation
  // returning the proposed plan; the caller then persists via updateEvent.
  return useMutation<ReorderResult, Error, Parameters<typeof api.reorder>[0]>({
    mutationFn: (body) => api.reorder(body),
  });
}

// ---- Suggest best slot ---------------------------------------------------
export function useSuggest() {
  return useMutation({
    mutationFn: (body: Parameters<typeof api.suggest>[0]) => api.suggest(body),
  });
}

// ---- Search ---------------------------------------------------------------
export function useSearchEvents(q: string) {
  return useQuery<{ events: CalendarEvent[] }>({
    queryKey: ["events", "search", q],
    queryFn: () => api.searchEvents(q),
    enabled: q.trim().length > 0,
    staleTime: 10_000,
  });
}

// ---- Reseed ---------------------------------------------------------------
export function useReseed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.reseed(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["calendars"] });
    },
  });
}

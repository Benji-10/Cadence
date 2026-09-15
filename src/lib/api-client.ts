// Thin typed client for the calendar API. Works from the browser only.
import type { Calendar, CalendarEvent, ReorderResult } from "./types";

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => jfetch<{ calendars: Calendar[]; weekStart?: string; seeded?: number; bootstrapped: boolean; eventCount?: number }>("/api/bootstrap"),

  listEvents: (from: string, to: string) =>
    jfetch<{ events: CalendarEvent[] }>(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  createEvent: (input: Partial<CalendarEvent> & { title: string; start: string; end: string; calendarId: string }) =>
    jfetch<{ event: CalendarEvent }>("/api/events", { method: "POST", body: JSON.stringify(input) }),

  updateEvent: (id: string, patch: Partial<CalendarEvent>) =>
    jfetch<{ event: CalendarEvent }>(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deleteEvent: (id: string) =>
    jfetch<{ ok: true }>(`/api/events/${id}`, { method: "DELETE" }),

  searchEvents: (q: string, limit = 30) =>
    jfetch<{ events: CalendarEvent[] }>(
      `/api/events/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  // Returns a URL that triggers a .ics download (opens in a new tab).
  icsExportUrl: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return `/api/ical${qs ? "?" + qs : ""}`;
  },

  // Upload an .ics string to be parsed and imported into a calendar.
  icsImport: (ics: string, calendarId: string) =>
    jfetch<{ imported: number; updated: number; titles: string[] }>("/api/ical/import", {
      method: "POST",
      body: JSON.stringify({ ics, calendarId }),
    }),

  reorder: (body: {
    mode: "week" | "around";
    rangeStart: string;
    rangeEnd: string;
    events?: CalendarEvent[];
    anchor?: CalendarEvent;
    newStart?: string;
    newEnd?: string;
  }) => jfetch<ReorderResult>("/api/events/reorder", { method: "POST", body: JSON.stringify(body) }),

  suggest: (body: {
    task: { category: string; locationType: CalendarEvent["locationType"]; minChunkMins: number; flexibility: string };
    durationMins: number;
    rangeStart: string;
    rangeEnd: string;
    aroundEvents?: CalendarEvent[];
  }) => jfetch<{ plan: { placements: { start: string; end: string }[]; score: number; reason: string } | null }>("/api/events/reschedule", { method: "POST", body: JSON.stringify(body) }),

  listCalendars: () => jfetch<{ calendars: Calendar[] }>("/api/calendars"),
  createCalendar: (input: { name: string; color: string; kind?: string }) =>
    jfetch<{ calendar: Calendar }>("/api/calendars", { method: "POST", body: JSON.stringify(input) }),

  reseed: () => jfetch<{ ok: true; seeded: number; weekStart: string }>("/api/seed", { method: "POST" }),
};

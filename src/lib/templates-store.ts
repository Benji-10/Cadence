"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// User-defined event templates for quick-add. Each template captures the
// fields you'd otherwise re-type every time (title, default duration, calendar,
// location, category metadata). Persisted to localStorage.
export interface EventTemplate {
  id: string;
  title: string;
  durationMins: number;
  calendarId: string | null;
  location?: string;
  color?: string | null;
  // intelligence metadata (optional — inferred from title if omitted)
  category?: string;
  flexibility?: string;
  locationType?: string;
}

export interface TemplatesState {
  templates: EventTemplate[];
  addTemplate: (t: Omit<EventTemplate, "id">) => void;
  removeTemplate: (id: string) => void;
  updateTemplate: (id: string, patch: Partial<EventTemplate>) => void;
}

function genId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useTemplates = create<TemplatesState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (t) =>
        set((s) => ({
          templates: [...s.templates, { ...t, id: genId() }],
        })),
      removeTemplate: (id) =>
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
        })),
      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),
    }),
    { name: "cadence-templates", skipHydration: true }
  )
);

// Manually hydrate on client (same pattern as settings-store).
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("cadence-templates");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.state) {
        useTemplates.setState(parsed.state);
      }
    }
  } catch {
    // use defaults
  }
}

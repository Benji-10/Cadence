"use client";

import { create } from "zustand";

// Undo stack for calendar mutations. Before each move/resize/create/delete,
// the caller pushes a snapshot of the affected events' pre-mutation state.
// Undo pops the most recent snapshot and restores it.

export interface UndoEntry {
  label: string;
  // events to restore (each with its pre-mutation start/end)
  events: { id: string; start: string; end: string }[];
  // events to delete (for undoing a create)
  createdIds?: string[];
  // event to recreate (for undoing a delete)
  deleted?: { id: string; title: string; start: string; end: string; calendarId: string; [k: string]: unknown };
}

interface UndoState {
  stack: UndoEntry[];
  push: (entry: UndoEntry) => void;
  pop: () => UndoEntry | undefined;
  clear: () => void;
  canUndo: () => boolean;
}

export const useUndo = create<UndoState>((set, get) => ({
  stack: [],
  push: (entry) =>
    set((s) => ({
      // cap at 50 entries to bound memory
      stack: [...s.stack, entry].slice(-50),
    })),
  pop: () => {
    const s = get().stack;
    if (s.length === 0) return undefined;
    const last = s[s.length - 1];
    set({ stack: s.slice(0, -1) });
    return last;
  },
  clear: () => set({ stack: [] }),
  canUndo: () => get().stack.length > 0,
}));

"use client";

import { createContext, useContext } from "react";

interface VisibilityCtx {
  visibility: Record<string, boolean>;
  toggle: (id: string) => void;
}

export const CalendarVisibilityContext = createContext<VisibilityCtx>({
  visibility: {},
  toggle: () => {},
});

export function useCalendarVisibility() {
  return useContext(CalendarVisibilityContext);
}

# Task 4 — Cadence Calendar UI

Working on building the full calendar UI at `/`. See `/home/z/my-project/worklog.md` for full context.

## Plan
1. `src/lib/calendar-ui.ts` — UI helpers: hour height constant, event color resolution, contrast text, lane layout, time formatting.
2. `src/hooks/use-calendar-data.ts` — React Query hooks for all API methods.
3. `src/hooks/use-event-drag.ts`, `src/hooks/use-event-resize.ts` — pointer-based interaction logic.
4. `src/components/calendar/` — toolbar, week-view, day-view, time-axis, day-column, event-block, now-line, edit-sheet, calendar-manager, reorder-preview.
5. `src/components/calendar/calendar-app.tsx` — top-level client component.
6. `src/app/page.tsx` — renders CalendarApp.

## Notes for future agents
- The `notifications` singleton is wired in `calendar-app.tsx`.
- `HOUR_HEIGHT = 56` is the constant we use in JS; CSS `--cal-hour-h` matches.
- Drag is vertical-only (changes time, not day); day changes go through the edit sheet's date picker.
- All times are local (browser tz); stored as ISO strings.

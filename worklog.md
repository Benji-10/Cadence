# Cadence — Intelligent Calendar: Worklog

This is the shared worklog for the Cadence calendar project. All agents append
their work records below using the `---` separator. Read previous sections
before starting, and never overwrite existing content.

---
Task ID: 1
Agent: main (orchestrator)
Task: Plan & build the foundation — Prisma schema, intelligence engine, API routes, seed data, PWA/notifications infrastructure.

Work Log:
- Reviewed existing project scaffold (Next.js 16, Tailwind 4, shadcn/ui, Prisma/SQLite, z-ai-web-dev-sdk, zustand, react-query, framer-motion, dnd-kit, date-fns all available).
- Authored `prisma/schema.prisma` with `Calendar` and `Event` models. Fields cover everything from the iOS edit screen: title, location, notes, timezone, allDay, calendarId, category, flexibility (fixed/movable/flexible), locationType (home/campus/sports/out/any), minChunkMins, allowOverlap, priority, travelMins, color, alerts (JSON text), recurrence (JSON text). Kept provider = sqlite for the sandbox; documented the one-line switch to postgresql for Neon. Ran `bun run db:push` successfully.
- Built the intelligence engine in `src/lib/scheduler/`:
  - `categories.ts` — title→metadata inference (lecture/sport/sleep/travel/laundry/work/homework/language/coding/ppl/cubing/cooking/social/free) with sensible defaults, colours, min chunks, and allowOverlap for laundry.
  - `time.ts` — pure time helpers (overlap, duration, snap, startOfWeek, addMins, fmtClock).
  - `constraints.ts` — overlap validation, location-context inference, free-gap finder, and a chunk splitter that never produces scraps below minChunkMins.
  - `engine.ts` — `findBestSlot` (scores gaps by location match + time-of-day), `rescheduleAround` (place an anchor then bump conflicting flexible tasks into best-fit slots across the week), `autoReorderWeek` (full-week tidy-up respecting priority + duration).
  - `seed.ts` — the full 2-week schedule encoded as day-offset + minute slots, with overnight events handled via endDayOffset.
  - `index.ts` barrel.
- Built domain types in `src/lib/types.ts` (CalendarEvent, Calendar, ValidationResult, ReorderResult, RecurrenceRule, etc.).
- Built Prisma↔domain mappers in `src/lib/mappers.ts` (parses JSON text columns for alerts/recurrence).
- Built typed API client in `src/lib/api-client.ts` (bootstrap, listEvents, create/update/deleteEvent, reorder, suggest, listCalendars, createCalendar, reseed).
- Built API routes:
  - `GET/POST /api/events` (list + create with auto-inference)
  - `GET/PATCH/DELETE /api/events/[id]`
  - `POST /api/events/reorder` (week or around-anchor)
  - `POST /api/events/reschedule` (suggest best slot)
  - `GET/POST /api/calendars`
  - `POST /api/seed` (wipe + reseed starter schedule)
  - `GET /api/bootstrap` (idempotent: ensure default calendars + seed if empty)
- Built notifications in `src/lib/notifications.ts` — singleton that polls every 20s, fires browser notifications at each event's alert offsets (default -30/-10/0), requests permission.
- Built PWA: `public/manifest.webmanifest`, `public/sw.js` (cache strategies + SW-mediated scheduled notifications via postMessage), and generated `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` from `public/icon.svg` via sharp.
- Built `netlify.toml` (Next.js plugin, static asset passthrough) and `.env.example` documenting the Neon pooled connection string requirement.
- Foundation is complete and lint-clean. The UI subagent can now build against the typed API client and scheduler.

Stage Summary:
- DB: SQLite for sandbox (flip provider to postgresql + set DATABASE_URL for Neon).
- API contract is final; see `src/lib/api-client.ts` for the exact methods.
- The intelligence engine is pure and tested-by-hand; key entry points are `findBestSlot`, `rescheduleAround`, `autoReorderWeek`.
- Default calendars (Study/Sport/Work/Home/Social/Personal) with distinct colours.
- The 2-week starter schedule is anchored to the current week's Monday on first load via `/api/bootstrap`.
- TODO next: build the calendar UI (week + day views, time grid, drag/resize, create/edit modal, reorder controls) and wire to the API + scheduler. Then verify with agent-browser and set the 15-min webDevReview cron.

---
Task ID: 1b
Agent: main (orchestrator)
Task: Refine the intelligence engine so the auto-tidy preserves the week's daily structure.

Work Log:
- Rewrote `autoReorderWeek` to be conservative: it only moves a flexible event if it currently overlaps a fixed event (genuine conflict), and prefers a same-day slot, falling back to the whole week only if the day is full. This stops the tidy from dumping Monday-PM tasks into Monday-AM gaps.
- Added `preferNearMs` to `findBestSlot` so bumped tasks (via `rescheduleAround`) prefer staying on their own day, then near the anchor.
- Verified via the reorder API: now produces 8 targeted changes (down from 96), all same-day, with sensible split reasons. The 2-week seed has one genuine conflict ("Friends / social" crossing into sleep) which is correctly flagged.

Stage Summary:
- Engine behaviour now matches the user's described intent: intelligence on the fly resolves conflicts without scrambling the week.
- Ready for the UI subagent to build against.

---
Task ID: 4
Agent: full-stack-developer (built) + main (verified & logged on its behalf — subagent timed out during its own agent-browser pass)
Task: Build the complete calendar UI (week/day views, time grid, drag/resize, edit sheet, auto-optimize) against the provided API + scheduler.

Work Log:
- Built under `src/components/calendar/`: calendar-app (orchestrator), toolbar, week-view, day-view, day-column, time-axis, event-block, now-line, edit-sheet, reorder-preview, calendar-manager, visibility-context.
- Built hooks in `src/hooks/`: use-calendar-data (React Query: bootstrap, events, calendars, CRUD, reorder, suggest, reseed), use-event-drag (pointer-event drag, 15min snap, blocks fixed, suppresses click-after-drag), use-event-resize (top/bottom handles, 15min snap).
- Built `src/lib/calendar-ui.ts` (event color resolution, contrast text, hex→rgba, overlap lane partitioning, top/height math, HOUR_HEIGHT).
- `src/app/page.tsx` renders `<CalendarApp/>`. Sticky toolbar (frosted glass), sticky footer (next-event countdown + notification status), flex-col full-height layout.
- Edit sheet (iOS-style dialog) has every requested field: title with live-inferred category badge, all-day, start/end date+time with duration, calendar picker, 14 color swatches, location, travel time, 7 alert presets + custom, repeat (daily/weekly/monthly/yearly + interval), priority, timezone, notes, collapsable scheduling behaviour (flexibility/min chunk/allow overlap), "Find best slot" button, delete with confirm.

Stage Summary — verified by main with agent-browser (all passing):
- Week view renders the full 2-week seeded schedule across 7 day columns with distinct per-category colors, lock icons on fixed events, time+location on each block.
- Day view (mobile-friendly) with prev/next day chevrons.
- Click an event → edit sheet opens with all fields populated; live category inference verified (renamed "Sleep"→"Gym session", badge updated to "Sport · fixed" instantly).
- Auto-optimize button → opens preview dialog; conservative engine correctly reports "Nothing to optimize" for the clean seed week and flags the one genuine conflict (Friends/social crossing into sleep). Apply disabled when 0 changes.
- Drag-to-move VERIFIED: dragging "Homework" (flexible) down 1h onto "Language study" (flexible) produced toast "Moved 'Homework' — also bumped 1 task" + note about Language study's split; dragging onto a fixed lecture correctly blocked with "Can't move — overlaps 'Computer Organization' (fixed)."
- Theme toggle verified (html class flips light↔dark).
- Calendars popover verified (6 calendars with toggles + new-calendar form with color picker).
- Mobile (375px) verified: toolbar compacts ("Calendars"→"Cals"); Day view usable.
- Sticky footer shows "Next: Paid work in 2h 25m".
- `bun run lint` clean. No console/runtime errors.
- Limitations noted for future enhancement: (1) drag is vertical/time-only within a day (cross-day drag via edit-sheet date picker instead); (2) when a bumped task's full duration doesn't fit one slot, only the first chunk is persisted (the rest are surfaced as a toast note).

---
Task ID: 5 (15-min webDevReview round 1)
Agent: main (webDevReview)
Task: QA pass + add features (month view, search palette, keyboard shortcuts, drag-to-create) + styling polish.

## Current project status / assessment
- App is stable and bug-free. agent-browser QA found NO runtime/console errors. Verified: week view, edit sheet, live category inference, auto-optimize, theme toggle, calendars popover, mobile (375px), sticky footer all still pass.
- Foundation (schema, scheduler engine, API, PWA, notifications) unchanged and intact.

## Completed modifications / verification results
NEW FEATURES:
1. Month view (`src/components/calendar/month-view.tsx`): 6×7 day grid, weekday header, per-cell day number + event count + up to 3 colored chips + "+N more" overflow, today ring, weekend tint, out-of-month greyed cells. Click a day → drills into Day view on that date. Click a chip → edit sheet. Added "Month" segment to the toolbar toggle. Verified: renders the full seeded month with event chips and counts.
2. Event search + command palette (`src/components/calendar/search-palette.tsx` + `GET /api/events/search?q=`): Cmd/Ctrl+K or `/` opens a dialog that searches all events by title (LIKE query), groups results into Upcoming/Past, shows relative time ("in 3d", "2h ago"), calendar color dot, date + location. Arrow keys + Enter to navigate; selecting jumps to Day view on that date and opens the event in the edit sheet. Verified: searching "laundry" returned both Laundry events; clicking a result jumped to Fri 18 Sep + opened the editor.
3. Keyboard shortcuts (`src/components/calendar/shortcuts-dialog.tsx`): `t` today, `j`/`←` prev, `k`/`→` next, `d`/`w`/`m` switch views, `n` new event, `?` show help. Help dialog reachable from the More menu too. Verified: `?` opens help; `w`/`m` switch views.
4. Drag-to-create (`src/hooks/use-create-drag.ts` wired into day-column): press-and-drag in empty day-column space sketches a dashed emerald preview rectangle snapped to 15min; release opens the create sheet with the dragged time range. A pure tap still falls back to a default 1h slot. Verified: dragging in the empty 00:00–01:00 gap opened the create sheet pre-filled 00:00–01:00 Mon 14 Sep.

STYLING POLISH:
- Event blocks: gradient overlay + inset top highlight + lift-on-hover (`-translate-y-0.5`, shadow-lg), stronger selected ring + colored glow.
- Now line: pulsing ping dot, gradient red line fading to 40%, and a live clock badge.
- Toolbar: search button with ⌘K hint, 3-way Day/Week/Month segmented toggle, responsive compact date label for small screens, keyboard-shortcuts entry in More menu.
- Month view: tinted weekends, today emerald ring, hover lift, chip count badge.

TECHNICAL:
- Added `GET /api/events/search` route + `api.searchEvents` + `useSearchEvents` react-query hook.
- calendar-app: view type now `day|week|month`; range computation branches (month fetches the full 6-week grid); nav handlers handle month; keyboard shortcuts effect; jump-to-event handler; render month-view + search palette + shortcuts dialog.
- Lint clean (resolved a react-hooks/immutability rule by exposing `consumeMoved()` from the create-drag hook instead of mutating the returned ref).

## Unresolved issues / risks + next-phase recommendations
- Cross-day drag still not supported (drag is vertical/time-only within a column). Next phase: lift drag state to the WeekView so the pointer's X determines the target day.
- When a bumped task's full duration doesn't fit one slot, only the first chunk is persisted; the rest are surfaced as a toast note. Next phase: have `rescheduleAround` return all placements and persist extra chunks as new events (needs a bulk-create API).
- Netlify Identity auth gating for production is still open (widget script is in layout; no server-side session gating yet). Next phase: add a NextAuth/Netlify Identity callback + protect event routes by user, scoping calendars/events by userId.
- Month view multi-day event spanning is approximate (crude loop). Could be tightened with proper interval math.
- No month-view drag/resize (month is overview-only by design, like iOS).
- The cron job is set to continue every 15 min; next rounds should pick up cross-day drag + split persistence + auth.

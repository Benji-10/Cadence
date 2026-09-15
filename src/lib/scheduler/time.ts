// Pure time helpers used by the scheduler. Kept dependency-free so the engine
// can run on both server and client.

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString();
}

export function overlapMins(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(toMs(aStart), toMs(bStart));
  const end = Math.min(toMs(aEnd), toMs(bEnd));
  return Math.max(0, Math.round((end - start) / MIN));
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return overlapMins(aStart, aEnd, bStart, bEnd) > 0;
}

export function durationMins(start: string, end: string): number {
  return Math.round((toMs(end) - toMs(start)) / MIN);
}

export function addMins(iso: string, mins: number): string {
  return fromMs(toMs(iso) + mins * MIN);
}

// Snap a timestamp to the nearest N minutes (default 15).
export function snapTo(iso: string, stepMins = 15): string {
  const ms = toMs(iso);
  const rounded = Math.round(ms / (stepMins * MIN)) * (stepMins * MIN);
  return fromMs(rounded);
}

export function startOfDay(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfWeek(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  // week starts Monday
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}

export function addDays(iso: string, days: number): string {
  return fromMs(toMs(iso) + days * DAY);
}

export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Format minutes-since-midnight as "09:30".
export function fmtClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Minutes since local midnight for an ISO string (using its local components).
export function minsSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

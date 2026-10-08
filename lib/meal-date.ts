import { addDays, format, startOfDay } from "date-fns";

export function mealDateUrl(date: Date) {
  const start = startOfDay(date);
  return dashboardDateUrl(start, addDays(start, 1), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function dashboardDateUrl(start: Date, end: Date, timeZone: string): `/dashboard?${string}` {
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), timeZone });
  return `/dashboard?${params}`;
}

export function localMealDateTime(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function parseLocalMealDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  // Reject invalid calendar values and times skipped by daylight saving time.
  if (!Number.isFinite(date.getTime()) || localMealDateTime(date) !== value) return null;
  return date;
}

export function editedMealDateTime(value: string, originalTimestamp: string) {
  const original = new Date(originalTimestamp);
  // Keep seconds, milliseconds, and the original offset in an overlapping DST hour.
  if (Number.isFinite(original.getTime()) && value === localMealDateTime(original)) return original;
  return parseLocalMealDateTime(value);
}

export function parseMealDateRange(
  start?: string | null,
  end?: string | null,
  timeZone?: string | null,
) {
  if (!start || !end || !timeZone) return null;

  const from = new Date(start);
  const to = new Date(end);
  const duration = to.getTime() - from.getTime();
  // Local days can be shorter or longer when daylight saving time changes.
  if (!Number.isFinite(duration) || duration < 22 * 3600000 || duration > 26 * 3600000) {
    return null;
  }

  try {
    const clock = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    if (clock.format(from) !== "00:00:00" || clock.format(to) !== "00:00:00"
      || from.getUTCMilliseconds() !== 0 || to.getUTCMilliseconds() !== 0) {
      return null;
    }
    return { start: from, end: to, timeZone };
  } catch {
    return null;
  }
}

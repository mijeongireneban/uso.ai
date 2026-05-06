/**
 * Formats an ISO 8601 reset timestamp into a human-readable string.
 * Returns "—" for null/missing values.
 * Examples: "in 45m", "in 2h 30m", "today 3:00 PM", "tomorrow 4:00 AM", "Mon 9:00 AM"
 */
export function formatResetTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffMins = Math.round(diffMs / 60000);

  // Past timestamps (e.g. Google's "1970-01-01" sentinel for exhausted-no-reset
  // buckets, or any reset that already fired between fetch cycles) → show "—".
  if (diffMins <= 0) return "—";

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 360) {
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = calendarDayDiff(date, new Date());
  if (days === 0) return `today ${timeStr}`;
  if (days === 1) return `tomorrow ${timeStr}`;
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayName} ${timeStr}`;
}

/**
 * Calendar-day diff between two dates (target − from), in the local timezone.
 * Returns the integer number of midnights crossed: 0 = same calendar date,
 * 1 = next calendar day, etc. (negative if `target` is in the past).
 *
 * Don't compute this from a duration like `Math.floor(diffMs / 86400000)` —
 * that measures 24-hour periods, not midnights, so a Sunday 4am reset viewed
 * from Saturday 10pm comes out as 0 days (≈0.25) and gets mislabeled "today"
 * instead of "tomorrow". (uso.ai#31)
 */
export function calendarDayDiff(target: Date, from: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

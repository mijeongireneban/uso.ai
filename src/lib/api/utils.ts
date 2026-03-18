/**
 * Formats an ISO 8601 reset timestamp into a human-readable string.
 * Returns "—" for null/missing values.
 * Examples: "in 45m", "in 2h 30m", "today 3:00 PM", "Mon 9:00 AM"
 */
export function formatResetTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 360) {
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayDiff = Math.floor(diffMs / 86400000);
  if (dayDiff === 0) return `today ${timeStr}`;
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayName} ${timeStr}`;
}

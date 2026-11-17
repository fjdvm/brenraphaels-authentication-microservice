const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Figma's "10 min ago", "2 days ago", "12 days ago". */
export function relativeTime(at: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - at.getTime());

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(elapsed / DAY);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

const MANILA = "Asia/Manila";
const clockFormat = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, month: "short", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat("en-US", { timeZone: MANILA, month: "short", day: "numeric", year: "numeric" });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA });

/** Figma's "Today, 12:30 PM" and "Yesterday, 4:25 PM", in Philippine days; older events name the date. */
export function formatEventTime(at: Date, now: Date): string {
  const day = dayKeyFormat.format(at);
  const clock = clockFormat.format(at);

  if (day === dayKeyFormat.format(now)) return `Today, ${clock}`;
  if (day === dayKeyFormat.format(new Date(now.getTime() - 86_400_000))) return `Yesterday, ${clock}`;

  const sameYear = day.slice(0, 4) === dayKeyFormat.format(now).slice(0, 4);
  return `${(sameYear ? dayFormat : dayYearFormat).format(at)}, ${clock}`;
}

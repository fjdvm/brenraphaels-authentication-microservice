const DAY_IN_MANILA = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Manila" });
const TIME_IN_MANILA = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const DATE_IN_MANILA = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Figma's "Today, 12:30 PM" and "Yesterday, 4:25 PM" in Philippine time; older ones as "Oct 15, 2026, 9:02 AM". */
export function formatSignInTime(at: Date, now: Date): string {
  // Philippine time has no daylight saving, so a day earlier is always 24 hours earlier.
  const day = DAY_IN_MANILA.format(at);
  const prefix =
    day === DAY_IN_MANILA.format(now)
      ? "Today"
      : day === DAY_IN_MANILA.format(new Date(now.getTime() - DAY_MS))
        ? "Yesterday"
        : DATE_IN_MANILA.format(at);

  return `${prefix}, ${TIME_IN_MANILA.format(at)}`;
}

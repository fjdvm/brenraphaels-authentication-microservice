const HOUR_IN_MANILA = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" });

/** Figma's "Good afternoon, Jude", by the time of day in Philippine time. */
export function greetingFor(now: Date): string {
  const hour = Number(HOUR_IN_MANILA.format(now));

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

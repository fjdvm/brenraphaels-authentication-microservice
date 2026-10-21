import { describe, expect, it } from "vitest";

import { formatSignInTime } from "./sign-in-time";

// 2:30 PM on Oct 21, 2026 in Manila.
const now = new Date("2026-10-21T06:30:00Z");

describe("formatSignInTime", () => {
  it.each([
    ["2026-10-21T06:10:00Z", "Today, 2:10 PM"],
    ["2026-10-20T16:05:00Z", "Today, 12:05 AM"], // just after midnight in Manila, still Oct 20 in UTC
    ["2026-10-20T08:25:00Z", "Yesterday, 4:25 PM"],
    ["2026-10-20T15:59:00Z", "Yesterday, 11:59 PM"],
    ["2026-10-19T15:59:00Z", "Oct 19, 2026, 11:59 PM"],
    ["2026-10-15T01:02:00Z", "Oct 15, 2026, 9:02 AM"],
    ["2025-12-31T16:30:00Z", "Jan 1, 2026, 12:30 AM"],
  ])("shows %s in Philippine time as %s", (at, expected) => {
    expect(formatSignInTime(new Date(at), now)).toBe(expected);
  });
});

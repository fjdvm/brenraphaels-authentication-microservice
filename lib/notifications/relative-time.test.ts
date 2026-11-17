import { describe, expect, it } from "vitest";

import { relativeTime } from "./relative-time";

const now = new Date("2026-11-17T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("relativeTime", () => {
  it.each([
    [10_000, "just now"],
    [10 * 60_000, "10 min ago"],
    [60 * 60_000, "1 hour ago"],
    [5 * 3_600_000, "5 hours ago"],
    [24 * 3_600_000, "1 day ago"],
    [2 * 86_400_000, "2 days ago"],
    [12 * 86_400_000, "12 days ago"],
  ])("%i ms ago reads %s", (elapsed, text) => {
    expect(relativeTime(ago(elapsed), now)).toBe(text);
  });

  it("never reads a time in the future", () => {
    expect(relativeTime(new Date(now.getTime() + 5000), now)).toBe("just now");
  });
});

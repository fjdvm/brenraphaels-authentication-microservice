import { describe, expect, it } from "vitest";

import { dayRangeBounds, defaultDayRange, parseSystemLogFilters } from "./system-logs-query";

describe("System logs date range", () => {
  it("defaults to the last 7 days, today in Philippine time included", () => {
    expect(defaultDayRange(new Date("2026-10-21T10:00:00Z"))).toEqual({ from: "2026-10-15", to: "2026-10-21" });
  });

  it("is already tomorrow in the Philippines late in the UTC evening", () => {
    expect(defaultDayRange(new Date("2026-10-21T17:00:00Z"))).toEqual({ from: "2026-10-16", to: "2026-10-22" });
  });

  it("covers whole Philippine days, and leaves an open end open", () => {
    expect(dayRangeBounds({ from: "2026-10-15", to: "2026-10-21" })).toEqual({
      from: "2026-10-15T00:00:00.000+08:00",
      to: "2026-10-21T23:59:59.999+08:00",
    });
    expect(dayRangeBounds({ from: "", to: "2026-10-21" })).toEqual({ to: "2026-10-21T23:59:59.999+08:00" });
  });
});

describe("parsing System log filters from the browser", () => {
  it("keeps valid filters and drops everything else", () => {
    expect(
      parseSystemLogFilters({
        q: " ada ",
        from: "2026-10-15T00:00:00.000+08:00",
        to: "not a date",
        action: "user.login",
        source: "",
        outcome: "FAILURE",
        cursor: "abc",
        actor_id: "someone-else",
      }),
    ).toEqual({
      q: "ada",
      from: "2026-10-15T00:00:00.000+08:00",
      to: undefined,
      action: "user.login",
      source: undefined,
      outcome: "FAILURE",
      cursor: "abc",
    });
  });

  it("rejects an unknown outcome and non-object input", () => {
    expect(parseSystemLogFilters({ outcome: "maybe" }).outcome).toBeUndefined();
    expect(parseSystemLogFilters(null)).toEqual({});
  });
});

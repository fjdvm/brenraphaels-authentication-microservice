import { describe, expect, it } from "vitest";

import { greetingFor } from "./greeting";

describe("greetingFor", () => {
  it.each([
    ["2026-10-21T23:30:00Z", "Good morning"], // 7:30 AM in Manila
    ["2026-10-21T03:59:00Z", "Good morning"], // 11:59 AM
    ["2026-10-21T04:00:00Z", "Good afternoon"], // 12:00 PM
    ["2026-10-21T09:59:00Z", "Good afternoon"], // 5:59 PM
    ["2026-10-21T10:00:00Z", "Good evening"], // 6:00 PM
    ["2026-10-21T18:00:00Z", "Good evening"], // 2:00 AM
  ])("greets by the time of day in Philippine time at %s", (instant, greeting) => {
    expect(greetingFor(new Date(instant))).toBe(greeting);
  });
});

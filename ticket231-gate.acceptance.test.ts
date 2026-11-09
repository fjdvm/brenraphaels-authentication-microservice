import { expect, it } from "vitest";

it("deliberately fails once to verify ticket #231's CI gate", () => {
  expect(true).toBe(false);
});

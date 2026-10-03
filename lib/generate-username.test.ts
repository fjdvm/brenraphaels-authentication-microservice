import { describe, expect, it } from "vitest";

import { generateUsername, usernameInitial } from "./generate-username";

describe("generateUsername", () => {
  it("generates a username from the year, initials, and sequence number", () => {
    expect(generateUsername(2026, "Jane", "Doe", 42)).toBe("2026-JD-042");
  });

  it("zero-pads a single-digit sequence number", () => {
    expect(generateUsername(2026, "Ada", "Lovelace", 1)).toBe("2026-AL-001");
  });

  it("zero-pads a two-digit sequence number", () => {
    expect(generateUsername(2026, "Grace", "Hopper", 10)).toBe("2026-GH-010");
  });

  it("keeps a three-digit sequence number unpadded", () => {
    expect(generateUsername(2026, "Katherine", "Johnson", 100)).toBe(
      "2026-KJ-100",
    );
  });

  it("uses the supplied shared counter for people with the same initials", () => {
    expect(generateUsername(2026, "Jane", "Doe", 7)).toBe("2026-JD-007");
    expect(generateUsername(2026, "John", "Davis", 8)).toBe("2026-JD-008");
  });

  it("does not retain sequence state between years", () => {
    expect(generateUsername(2026, "Ada", "Lovelace", 1)).toBe("2026-AL-001");
    expect(generateUsername(2027, "Ada", "Lovelace", 1)).toBe("2027-AL-001");
  });

  it("uses initials after Unicode normalization and diacritic stripping", () => {
    expect(generateUsername(2026, "Élodie", "Åström", 1)).toBe(
      "2026-EA-001",
    );
  });

  it("makes invalid name initials detectable to callers", () => {
    expect(usernameInitial("Élodie")).toBe("E");
    expect(usernameInitial("李")).toBeNull();
  });

  it.each([
    ["1st", "Doe"],
    ["😀", "Doe"],
    ["李", "Doe"],
    ["Jane", "2nd"],
  ])("rejects names that cannot supply an A-Z initial: %s %s", (firstName, lastName) => {
    expect(() => generateUsername(2026, firstName, lastName, 1)).toThrow(
      "must start with an A-Z letter",
    );
  });
});

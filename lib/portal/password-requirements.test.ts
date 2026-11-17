import { describe, expect, it } from "vitest";

import { PASSWORD_REQUIREMENTS } from "./password-requirements";

const met = (password: string) => PASSWORD_REQUIREMENTS.filter(({ isMet }) => isMet(password)).map(({ label }) => label);

describe("PASSWORD_REQUIREMENTS", () => {
  it("lists the four Figma chips in order", () => {
    expect(PASSWORD_REQUIREMENTS.map(({ label }) => label)).toEqual([
      "8+ characters",
      "Uppercase letter",
      "Number",
      "Special character",
    ]);
  });

  it("meets none of them for an empty password", () => {
    expect(met("")).toEqual([]);
  });

  it("meets length, uppercase and number but not special for the Figma example", () => {
    expect(met("Passw0rd12")).toEqual(["8+ characters", "Uppercase letter", "Number"]);
  });

  it("meets all four with a symbol", () => {
    expect(met("Passw0rd!")).toHaveLength(4);
  });
});

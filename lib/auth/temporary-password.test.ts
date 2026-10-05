import { describe, expect, it } from "vitest";

import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

import { generateTemporaryPassword, TEMPORARY_PASSWORD_LENGTH } from "./temporary-password";

describe("generateTemporaryPassword", () => {
  it("is long enough, mixed-class and unambiguous to read", () => {
    for (let run = 0; run < 50; run += 1) {
      const password = generateTemporaryPassword();

      expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%*?]/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it("does not repeat", () => {
    const passwords = new Set(Array.from({ length: 100 }, generateTemporaryPassword));

    expect(passwords.size).toBe(100);
  });
});

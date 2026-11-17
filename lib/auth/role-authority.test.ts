import { describe, expect, it } from "vitest";

import { accessFor, canReadShopSettings, canView, canWrite } from "./role-authority";

describe("role authority", () => {
  it.each([
    ["Admin", "full", true, true],
    ["CEO", "view", true, false],
    ["General Manager", "none", false, false],
    ["Super Admin", "none", false, false],
    ["toString", "none", false, false],
  ] as const)("%s has %s access", (role, access, read, write) => {
    expect(accessFor(role)).toBe(access);
    expect(canView(role)).toBe(read);
    expect(canWrite(role)).toBe(write);
  });

  it("lets CRMS managers read shop Settings but never write", () => {
    expect(canReadShopSettings("CRMS Manager")).toBe(true);
    expect(canWrite("CRMS Manager")).toBe(false);
    expect(canReadShopSettings("Cashier")).toBe(false);
  });
});

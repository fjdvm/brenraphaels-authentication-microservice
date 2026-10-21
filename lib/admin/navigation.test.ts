import { describe, expect, it } from "vitest";

import { ADMIN_NAVIGATION, SIDEBAR_NAVIGATION } from "./navigation";

describe("ADMIN_NAVIGATION", () => {
  it("gives every administrative destination a labelled, reachable entry point", () => {
    expect(ADMIN_NAVIGATION.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/admin/access", label: "Access" },
      { href: "/admin/users", label: "User management" },
      { href: "/admin/system-logs", label: "System logs" },
    ]);
  });

  it("keeps My logs out of the Administrator-only destinations", () => {
    expect(ADMIN_NAVIGATION.some(({ href }) => href === "/my-logs")).toBe(false);
  });
});

describe("SIDEBAR_NAVIGATION", () => {
  it("adds My logs after the administrative destinations", () => {
    expect(SIDEBAR_NAVIGATION.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/admin/access", label: "Access" },
      { href: "/admin/users", label: "User management" },
      { href: "/admin/system-logs", label: "System logs" },
      { href: "/my-logs", label: "My logs" },
    ]);
  });
});

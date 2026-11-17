import { describe, expect, it } from "vitest";

import { ADMIN_NAVIGATION, SIDEBAR_NAVIGATION, SIDEBAR_SECTIONS } from "./navigation";

describe("ADMIN_NAVIGATION", () => {
  it("gives every administrative destination a labelled, reachable entry point", () => {
    expect(ADMIN_NAVIGATION.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/admin/access", label: "Access" },
      { href: "/admin/users", label: "User management" },
      { href: "/admin/account-requests", label: "Account requests" },
      { href: "/admin/settings", label: "Settings" },
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
      { href: "/admin/account-requests", label: "Account requests" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/system-logs", label: "System logs" },
      { href: "/my-logs", label: "Activity log" },
    ]);
  });
});

describe("SIDEBAR_SECTIONS", () => {
  it("groups the sidebar as Access, MANAGEMENT, SETTINGS and AUDIT", () => {
    expect(
      SIDEBAR_SECTIONS.map(({ label, destinations }) => ({
        label,
        hrefs: destinations.map(({ href }) => href),
      })),
    ).toEqual([
      { label: undefined, hrefs: ["/admin/access"] },
      { label: "MANAGEMENT", hrefs: ["/admin/users", "/admin/account-requests"] },
      { label: "SETTINGS", hrefs: ["/admin/settings"] },
      { label: "AUDIT", hrefs: ["/admin/system-logs", "/my-logs"] },
    ]);
  });
});

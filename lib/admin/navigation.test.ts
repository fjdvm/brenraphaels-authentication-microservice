import { describe, expect, it } from "vitest";

import { ADMIN_NAVIGATION } from "./navigation";

describe("ADMIN_NAVIGATION", () => {
  it("gives every administrative destination a labelled, reachable entry point", () => {
    expect(ADMIN_NAVIGATION.map(({ href, label }) => ({ href, label }))).toEqual([
      { href: "/admin/access", label: "Access" },
      { href: "/admin/users", label: "User management" },
      { href: "/admin/system-logs", label: "System logs" },
    ]);
  });
});

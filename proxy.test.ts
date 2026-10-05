import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ auth: { middleware: () => () => undefined } }));

import { config } from "./proxy";

// Next compiles each matcher entry as an anchored pattern over the request path.
const runsProxyFor = (path: string) =>
  config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));

describe("proxy matcher", () => {
  it("leaves the authorize endpoint alone so it can keep a signed-out System request through login", () => {
    // The proxy would otherwise redirect straight to /login and drop the request.
    expect(runsProxyFor("/api/integrations/authorize")).toBe(false);
  });

  it("still leaves login and the server-to-server exchange public", () => {
    expect(runsProxyFor("/login")).toBe(false);
    expect(runsProxyFor("/api/integrations/exchange")).toBe(false);
  });

  it("keeps guarding the portal and the password-change page", () => {
    expect(runsProxyFor("/")).toBe(true);
    expect(runsProxyFor("/change-password")).toBe(true);
    expect(runsProxyFor("/admin/users")).toBe(true);
  });
});

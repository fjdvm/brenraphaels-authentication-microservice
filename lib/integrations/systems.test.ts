import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleSystems } from "./endpoints";
import { buildSystemRegistration } from "./registration";
import { hashToken } from "./tokens";
import type { SystemsPorts } from "./validation";

const { registration, secret } = buildSystemRegistration(["https://crms.example.com/cb"]);
const NOW = new Date("2026-10-07T10:00:00Z");
const basic = (s: string) => `Basic ${Buffer.from(`CRMS:${s}`).toString("base64")}`;

function setup(over: { grants?: string[]; eligible?: boolean; revoked?: boolean; central?: boolean } = {}) {
  const ports = {
    findSystemByName: async (name: string) => (name === "CRMS" ? { id: "sys-CRMS", name, ...registration } : null),
    isUserEligible: async () => over.eligible ?? true,
    isCentralSessionActive: async () => over.central ?? true,
    findIntegrationSession: async (hash: string) =>
      hash === hashToken("handle-1")
        ? {
            handleHash: hash,
            systemId: "sys-CRMS",
            userId: "user-1",
            neonSessionId: "n1",
            expiresAt: new Date(NOW.getTime() + 60_000),
            revokedAt: over.revoked ? NOW : null,
          }
        : null,
    listSystemNamesWithGrants: async () => over.grants ?? ["CRMS", "POS"],
    now: () => NOW,
  } as unknown as SystemsPorts;

  return (auth = basic(secret), handle: string | null = "handle-1") =>
    handleSystems(
      new Request("https://portal.example.com/api/integrations/systems", {
        method: "POST",
        headers: { Authorization: auth },
        body: JSON.stringify({ handle }),
      }),
      { ports },
    );
}

describe("POST /api/integrations/systems", () => {
  it("lists only the Systems the User holds a grant in", async () => {
    const res = await setup()();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ systems: ["CRMS", "POS"] });
  });

  it("rejects a wrong backend secret", async () => {
    expect((await setup()(basic("wrong"))).status).toBe(401);
  });

  it("rejects an unknown handle, a revoked session and a dead central session", async () => {
    expect((await setup()(basic(secret), "nope")).status).toBe(401);
    expect((await setup({ revoked: true })()).status).toBe(401);
    expect((await setup({ central: false })()).status).toBe(401);
  });

  it("denies an ineligible User", async () => {
    expect((await setup({ eligible: false })()).status).toBe(403);
  });

  it("requires a handle", async () => {
    expect((await setup()(basic(secret), null)).status).toBe(400);
  });
});

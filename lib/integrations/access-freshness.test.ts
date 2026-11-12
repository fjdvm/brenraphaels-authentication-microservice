import { beforeEach, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  grants: new Set<string>(),
  sessionActive: true,
  userDeleted: false,
  systemName: "POS",
  findSystem: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    system: { findUnique: database.findSystem },
    user: {
      findUnique: async () => ({
        isDeleted: database.userDeleted,
        mustChangePassword: false,
        firstName: "Ada",
        lastName: "Min",
        username: "2026-AM-001",
        email: "ada@example.com",
        role: { name: "Manager" },
      }),
    },
    accessGrant: {
      findFirst: async ({ where }: { where: { revokedAt: null; module: { name: string } } }) =>
        database.grants.has(where.module.name) ? { id: "grant-1" } : null,
    },
    integrationSession: {
      findUnique: async () => ({
        systemId: database.systemName.toLowerCase(),
        userId: "user-1",
        neonSessionId: "central-session",
        expiresAt: new Date("2099-01-01"),
        revokedAt: null,
      }),
    },
    $queryRaw: async () => database.sessionActive ? [{ id: "central-session" }] : [],
  },
}));

import { handleValidate } from "./endpoints";
import { prismaHandoffPorts } from "./prisma-ports.server";
import { hashToken } from "./tokens";

beforeEach(() => {
  database.grants = new Set(["Sales", "Stock"]);
  database.systemName = "POS";
  database.sessionActive = true;
  database.userDeleted = false;
  database.findSystem.mockResolvedValue({
    id: "pos",
    name: "POS",
    backendSecretHash: hashToken("backend-secret"),
  });
});

function validate(module = "Sales") {
  return handleValidate(new Request("https://portal.test/api/integrations/validate", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${database.systemName}:backend-secret`).toString("base64")}` },
    body: JSON.stringify({ handle: "same-handle", module }),
  }), { ports: prismaHandoffPorts, audit: async () => undefined });
}

it("denies a revoked Module on the next identical request through the production data adapter", async () => {
  const allowed = await validate();
  expect(allowed.status).toBe(200);
  expect(await allowed.json()).toMatchObject({ active: true, module: "Sales" });
  expect(allowed.headers.get("cache-control")).toBe("no-store");

  database.grants.delete("Sales");
  const denied = await validate();
  expect(denied.status).toBe(403);
  expect(await denied.json()).toMatchObject({ error: "access_denied" });
  expect(denied.headers.get("cache-control")).toBe("no-store");
  expect((await validate("Stock")).status).toBe(200);
});

it("never reuses a successful access answer after the central session is revoked", async () => {
  expect((await validate()).status).toBe(200);
  database.sessionActive = false;
  expect((await validate()).status).toBe(401);
});

it("keeps legacy HRMS hiring checks working only with all four replacement grants", async () => {
  database.systemName = "HRMS";
  database.findSystem.mockResolvedValue({ id: "hrms", name: "HRMS", backendSecretHash: hashToken("backend-secret") });
  database.grants = new Set(["Recruitment and Hiring"]);
  expect((await validate("Recruitment and Hiring")).status).toBe(200);
  database.grants = new Set(["Job Postings", "Applications", "Interviews", "Offers"]);
  expect((await validate("Recruitment and Hiring")).status).toBe(200);
  database.grants.delete("Offers");
  expect((await validate("Recruitment and Hiring")).status).toBe(403);
  expect((await validate("Applications")).status).toBe(200);
});

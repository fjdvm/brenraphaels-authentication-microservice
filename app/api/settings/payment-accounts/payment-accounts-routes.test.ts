import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentAccount } from "@/lib/settings/payment-accounts";

const getPortalUser = vi.fn();
const recordAuditEvent = vi.fn(async (_event: { action: string; actorId: string }) => {});
const rows = new Map<string, PaymentAccount>();
const authorized = { name: "Ecommerce", secret: "s3cret" };

vi.mock("@/lib/auth/session", () => ({ getPortalUser }));
vi.mock("@/lib/audit/audit-logs.server", () => ({ recordAuditEvent }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    paymentAccount: {
      findMany: vi.fn(async ({ where }: { where?: { active: boolean } } = {}) => [...rows.values()].filter((row) => !where || row.active === where.active)),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
      create: vi.fn(async ({ data }: { data: PaymentAccount }) => { const row = { ...data, id: `n${rows.size}`, active: true }; rows.set(row.id, row); return row; }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<PaymentAccount> }) => { const row = { ...rows.get(where.id)!, ...data }; rows.set(row.id, row); return row; }),
    },
  },
}));
vi.mock("@/lib/integrations/basic", () => ({ parseBasicCredentials: (header: string | null) => (header === "Basic ok" ? authorized : header === "Basic other" ? { name: "HRMS", secret: "x" } : null) }));
vi.mock("@/lib/integrations/prisma-ports.server", () => ({ prismaHandoffPorts: { findSystemByName: vi.fn(async () => ({ backendSecretHash: "hash" })) } }));
vi.mock("@/lib/integrations/tokens", () => ({ hashToken: () => "hash", safeEqual: (a: string, b: string) => a === b }));

const account = (over: Partial<PaymentAccount>): PaymentAccount => ({ id: "a", method: "GCASH", accountName: "Shop", accountNumber: "09171234567", bankName: "", active: true, ...over });
const json = (method: string, body: unknown) => new Request("http://portal.test/api", { method, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (roleName: string) => getPortalUser.mockResolvedValue({ id: "u", roleName, mustChangePassword: false });
const input = { method: "MAYA", accountName: "Second", accountNumber: "09181234567" };

beforeEach(() => {
  vi.clearAllMocks();
  rows.clear();
  rows.set("a", account({ id: "a" }));
  rows.set("b", account({ id: "b", method: "MAYA", accountName: "Old", active: false }));
});

describe("Payment accounts, Admin", () => {
  it("lists, adds, edits, deactivates and reactivates, logging each under the Admin", async () => {
    as("Admin");
    const list = await import("./route");
    const item = await import("./[id]/route");
    expect(((await (await list.GET()).json()) as { accounts: unknown[] }).accounts).toHaveLength(2);
    expect((await list.POST(json("POST", input))).status).toBe(201);
    expect((await item.PATCH(json("PATCH", { method: "GCASH", accountName: "Renamed", accountNumber: "09171234567" }), ctx("a"))).status).toBe(200);
    expect((await item.PATCH(json("PATCH", { active: false }), ctx("a"))).status).toBe(200);
    expect((await item.PATCH(json("PATCH", { active: true }), ctx("b"))).status).toBe(200);
    expect(rows.get("a")?.active).toBe(false);
    expect(rows.get("b")?.active).toBe(true);
    expect(recordAuditEvent.mock.calls.map(([event]) => event.action)).toEqual([
      "payment_account.create", "payment_account.update", "payment_account.deactivate", "payment_account.reactivate",
    ]);
    expect(recordAuditEvent.mock.calls.every(([event]) => event.actorId === "u")).toBe(true);
  });
  it("rejects a bad number with 400 and offers no way to delete", async () => {
    as("Admin");
    const list = await import("./route");
    const item = await import("./[id]/route");
    expect((await list.POST(json("POST", { ...input, accountNumber: "1" }))).status).toBe(400);
    expect((item as Record<string, unknown>).DELETE).toBeUndefined();
    expect((list as Record<string, unknown>).DELETE).toBeUndefined();
  });
});

describe("Payment accounts, CEO and others", () => {
  it.each(["CEO", "Manager", "Cashier"])("refuses %s every change and changes nothing", async (roleName) => {
    as(roleName);
    const list = await import("./route");
    const item = await import("./[id]/route");
    expect((await list.POST(json("POST", input))).status).toBe(403);
    expect((await item.PATCH(json("PATCH", { active: false }), ctx("a"))).status).toBe(403);
    expect((await item.PATCH(json("PATCH", { method: "GCASH", accountName: "x", accountNumber: "09171234567" }), ctx("a"))).status).toBe(403);
    expect(rows.get("a")?.active).toBe(true);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
  it("lets a CEO read but not an unrelated Role", async () => {
    const list = await import("./route");
    as("CEO");
    expect((await list.GET()).status).toBe(200);
    as("Cashier");
    expect((await list.GET()).status).toBe(403);
  });
  it("refuses a signed-out request", async () => {
    getPortalUser.mockResolvedValue(null);
    const list = await import("./route");
    expect((await list.POST(json("POST", input))).status).toBe(401);
  });
});

describe("The store's payment-details endpoint", () => {
  const call = async (authorization: string | null) => (await import("@/app/api/integrations/payment-details/route")).GET(new Request("http://portal.test/x", { headers: authorization ? { authorization } : {} }));
  it("returns only active accounts to the Ecommerce System", async () => {
    const res = await call("Basic ok");
    const body = (await res.json()) as { accounts: PaymentAccount[]; settings: { gcashNumber: string; mayaNumber: string } };
    expect(res.status).toBe(200);
    expect(body.accounts.map((a) => a.id)).toEqual(["a"]);
    expect(body.settings).toMatchObject({ gcashNumber: "09171234567", mayaNumber: "" });
  });
  it.each([[null], ["Basic other"]])("refuses %s", async (authorization) => {
    expect((await call(authorization)).status).toBe(401);
  });
});

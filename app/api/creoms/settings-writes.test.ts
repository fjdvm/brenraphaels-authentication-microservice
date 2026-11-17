import { beforeEach, describe, expect, it, vi } from "vitest";

const getPortalUser = vi.fn();
const callApprovalLimit = vi.fn(async () => ({ status: 200, body: { ok: true } }));
const callServiceLevels = vi.fn(async () => ({ status: 200, body: { ok: true } }));
vi.mock("@/lib/auth/session", () => ({ getPortalUser }));
vi.mock("@/lib/integrations/approval-limit", () => ({ callApprovalLimit, callServiceLevels }));

const post = (body: unknown) =>
  new Request("http://portal.test/x", { method: "POST", body: JSON.stringify(body) });

const writes = [
  ["Approval limit", () => import("./approval-limit/route"), { amountInCentavos: 100 }],
  ["Service levels", () => import("./service-levels/route"), { firstReplyHours: 2, resolveHours: 8 }],
] as const;

describe.each(writes)("%s write", (_name, load, body) => {
  beforeEach(() => vi.clearAllMocks());

  it.each([["CEO"], ["Manager"], ["Cashier"]])("answers %s with 403 and changes nothing", async (roleName) => {
    getPortalUser.mockResolvedValue({ id: "u", roleName, mustChangePassword: false });
    const { POST } = await load();
    const res = await POST(post(body));
    expect(res.status).toBe(403);
    expect(callApprovalLimit.mock.calls.length + callServiceLevels.mock.calls.length).toBe(0);
  });

  it("lets an Admin write", async () => {
    getPortalUser.mockResolvedValue({ id: "u", roleName: "Admin", mustChangePassword: false });
    const { POST } = await load();
    expect((await POST(post(body))).status).toBe(200);
  });

  it("lets a CEO read", async () => {
    getPortalUser.mockResolvedValue({ id: "u", roleName: "CEO", mustChangePassword: false });
    const { POST } = await load();
    expect((await POST(post({}))).status).toBe(200);
  });
});

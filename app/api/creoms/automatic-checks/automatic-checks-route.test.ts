import { beforeEach, describe, expect, it, vi } from "vitest";

const getPortalUser = vi.fn();
const callAutomaticChecks = vi.fn(async (_id: string, checks?: object): Promise<{ status: number; body: Record<string, unknown> }> => ({ status: 200, body: checks ? { ok: true } : { ok: true, checks: { paymentProof: {} } } }));
vi.mock("@/lib/auth/session", () => ({ getPortalUser }));
vi.mock("@/lib/integrations/approval-limit", () => ({ callAutomaticChecks }));

const put = (body: unknown) => new Request("http://portal.test/x", { method: "PUT", body: JSON.stringify(body) });
const as = (roleName: string) => getPortalUser.mockResolvedValue({ id: "u", roleName, mustChangePassword: false });

describe("Automatic checks proxy", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["CEO", "Manager", "Cashier"])("refuses a save from %s and changes nothing", async (roleName) => {
    as(roleName);
    const { PUT } = await import("./route");
    expect((await PUT(put({ cod: {} }))).status).toBe(403);
    expect(callAutomaticChecks).not.toHaveBeenCalled();
  });

  it("forwards an Admin's whole set to CREOMS under their identity", async () => {
    as("Admin");
    const { PUT } = await import("./route");
    const res = await PUT(put({ cod: {} }));
    expect(res.status).toBe(200);
    expect(callAutomaticChecks).toHaveBeenCalledWith("u", { cod: {} });
  });

  it("passes CREOMS's refusal through", async () => {
    as("Admin");
    callAutomaticChecks.mockResolvedValueOnce({ status: 400, body: { ok: false, reason: "Nope" } });
    const { PUT } = await import("./route");
    expect((await PUT(put({}))).status).toBe(400);
  });

  it("lets a CEO read but refuses Cashier and signed-out users", async () => {
    const { GET } = await import("./route");
    as("CEO");
    expect((await GET(new Request("http://portal.test/x"))).status).toBe(200);
    as("Cashier");
    expect((await GET(new Request("http://portal.test/x"))).status).toBe(403);
    getPortalUser.mockResolvedValue(null);
    expect((await GET(new Request("http://portal.test/x"))).status).toBe(401);
  });

  it("refuses a cross-origin save", async () => {
    as("Admin");
    const { PUT } = await import("./route");
    const res = await PUT(new Request("http://portal.test/x", { method: "PUT", headers: { origin: "http://evil.test" }, body: "{}" }));
    expect(res.status).toBe(403);
  });
});

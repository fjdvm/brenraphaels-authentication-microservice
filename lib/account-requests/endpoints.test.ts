import { describe, expect, it } from "vitest";
import { handleAccountRequest, handleAccountRequestOptions, type AccountRequestPorts } from "./endpoints";
import { hashToken } from "../integrations/tokens";
import { stubNotificationsService } from "../notifications/test-support";

const payload = {
  reference: "RQ-0001",
  employee: { name: "Ada Santos", workEmail: "ada@brenraphaels.ph", personalEmail: "ada@example.com", mobile: null, position: "Staff", branch: "Main", startDate: "2026-12-01" },
  roleId: "staff", moduleIds: ["info", "orders"], neededFrom: "2026-11-30", note: null, requestedBy: { name: "HR Manager" },
};
const options = {
  roles: [{ id: "staff", name: "Staff", moduleIds: ["info"] }],
  systems: [{ id: "hrms", name: "HRMS", modules: [{ id: "info", name: "Employee Information" }] }, { id: "crms", name: "CRMS", modules: [{ id: "orders", name: "Orders" }] }],
};
function setup() {
  const notifications = stubNotificationsService();
  const requests = new Map<string, { reference: string; status: string }>();
  const ports: AccountRequestPorts = {
    findSystemByName: async (name) => name === "HRMS" ? { id: "hrms", backendSecretHash: hashToken("secret") } : null,
    options: async () => options,
    findRequest: async (_systemId, reference) => requests.get(reference) ?? null,
    receive: async (_systemId, input) => {
      const result = { reference: input.reference, status: "new" };
      requests.set(input.reference, result);
      return { kind: "created", request: result };
    },
    administratorIds: async () => ["admin", "ceo"],
    notify: notifications.notify,
  };
  return { ports, sent: notifications.sent };
}
function request(body: unknown = payload, secret = "secret", system = "HRMS") {
  return new Request("https://portal.test/api/integrations/account-requests", { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${system}:${secret}`).toString("base64")}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("HRMS Account request endpoints", () => {
  it("authenticates before accepting a request and tells each Administrator once", async () => {
    const { ports, sent } = setup();
    expect((await handleAccountRequest(request(payload, "bad"), ports)).status).toBe(401);
    expect(sent).toEqual([]);
    const response = await handleAccountRequest(request(), ports);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ reference: "RQ-0001", status: "new" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(sent.map(message => message.userIds)).toEqual([["admin"], ["ceo"]]);
    expect(sent[0]).toMatchObject({ type: "account-request.new", title: "New Account request RQ-0001", body: expect.stringContaining("Ada Santos") });
    expect((await handleAccountRequest(request(), ports)).status).toBe(200);
    expect(sent).toHaveLength(2);
  });
});

it("returns the Role templates and cross-System Modules only to authenticated HRMS", async () => {
  const { ports } = setup();
  expect((await handleAccountRequestOptions(request(payload, "bad"), ports)).status).toBe(401);
  expect((await handleAccountRequestOptions(request(payload, "secret", "CRMS"), ports)).status).toBe(401);
  const response = await handleAccountRequestOptions(request(), ports);
  expect(await response.json()).toEqual(options);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("reports a taken work email without notifying Administrators", async () => {
  const { ports, sent } = setup();
  ports.receive = async () => ({ kind: "email-taken" });
  const response = await handleAccountRequest(request(), ports);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "email-taken" });
  expect(sent).toEqual([]);
});

it.each([
  { ...payload, roleId: "missing" }, { ...payload, moduleIds: ["retired"] },
  { ...payload, moduleIds: ["info", "info"] }, { ...payload, neededFrom: "2026-02-30" },
  { ...payload, employee: { ...payload.employee, workEmail: "invalid" } },
])("rejects malformed or unknown access requests", async body => {
  const { ports, sent } = setup();
  expect((await handleAccountRequest(request(body), ports)).status).toBe(400);
  expect(sent).toEqual([]);
});

it("fails closed during a database outage", async () => {
  const { ports } = setup();
  ports.findSystemByName = async () => { throw new Error("offline"); };
  expect((await handleAccountRequest(request(), ports)).status).toBe(503);
  expect((await handleAccountRequestOptions(request(), ports)).status).toBe(503);
});

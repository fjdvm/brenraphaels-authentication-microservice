import { expect, it, vi } from "vitest";
import { createFromRequest } from "./fulfillment";
import type { FulfillmentPorts } from "./fulfillment";

it("creates the requested User and sends the same login details to both emails before announcing login_sent", async () => {
  const sent: { to: string; temporaryPassword: string }[] = [];
  const statuses: string[] = [];
  const createUser = vi.fn(async () => { statuses.push("account_created"); return { id: "user", username: "2026-AS-001", systemNames: ["HRMS"] }; });
  const ports: FulfillmentPorts = {
    findRequest: async () => ({ workEmail: "ada@work.test", personalEmail: "ada@home.test", status: "seen" }),
    provisioning: {
      store: { emailExists: async () => false, roleExists: async () => true, countModules: async ids => ids.length, createUser, discardUser: vi.fn() },
      identity: { create: async () => ({ id: "auth" }), remove: vi.fn() },
      mailer: { sendCredentials: async message => { sent.push(message); } },
      audit: async () => {}, generatePassword: () => "Temp!1234",
    },
    loginSent: async () => { statuses.push("login_sent"); },
  };
  const result = await createFromRequest("request", { firstName: "Ada", lastName: "Santos", email: "tampered@test.com", roleId: "staff", moduleIds: ["info"] }, { id: "admin" }, ports);
  expect(result.ok).toBe(true);
  expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "ada@work.test", roleId: "staff", moduleIds: ["info"], grantedBy: "admin" }));
  expect(sent.map(message => [message.to, message.temporaryPassword])).toEqual([["ada@work.test", "Temp!1234"], ["ada@home.test", "Temp!1234"]]);
  expect(statuses).toEqual(["account_created", "login_sent"]);
});

it("refuses a closed request before attempting identity provisioning", async () => {
  const create = vi.fn();
  const ports: FulfillmentPorts = {
    findRequest: async () => ({ workEmail: "ada@work.test", personalEmail: "ada@home.test", status: "cancelled" }),
    provisioning: { store: { emailExists: vi.fn(), roleExists: vi.fn(), countModules: vi.fn(), createUser: vi.fn(), discardUser: vi.fn() }, identity: { create, remove: vi.fn() }, mailer: { sendCredentials: vi.fn() }, audit: vi.fn(), generatePassword: vi.fn() },
    loginSent: vi.fn(),
  };
  const result = await createFromRequest("request", { firstName: "Ada", lastName: "Santos", email: "ada@work.test", roleId: "staff", moduleIds: [] }, { id: "admin" }, ports);
  expect(result.ok).toBe(false);
  expect(create).not.toHaveBeenCalled();
});

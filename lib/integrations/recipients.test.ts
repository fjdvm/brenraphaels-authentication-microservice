import { expect, it, vi } from "vitest";
import { handleRecipients } from "./recipients";
import { hashToken } from "./tokens";

it("authenticates the System before returning only its eligible Staff and Modules", async () => {
  const list = vi.fn(async () => [{ id: "portal-user-id", modules: ["Orders"] }]);
  const ports = {
    findSystemByName: vi.fn(async () => ({ id: "crms-system", backendSecretHash: hashToken("secret") })),
    listEligibleStaff: list,
  };
  const request = (secret: string) => new Request("https://portal.test/api/integrations/recipients", {
    method: "POST", headers: { Authorization: `Basic ${Buffer.from(`CRMS:${secret}`).toString("base64")}` },
  });
  expect((await handleRecipients(request("wrong"), ports)).status).toBe(401);
  expect(list).not.toHaveBeenCalled();
  const response = await handleRecipients(request("secret"), ports);
  expect(await response.json()).toEqual({ staff: [{ id: "portal-user-id", modules: ["Orders"] }] });
  expect(list).toHaveBeenCalledWith("crms-system");
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("fails closed when the directory is unavailable", async () => {
  const response = await handleRecipients(new Request("https://portal.test", {
    headers: { Authorization: `Basic ${Buffer.from("CRMS:secret").toString("base64")}` },
  }), { findSystemByName: async () => { throw new Error("offline"); }, listEligibleStaff: vi.fn() });
  expect(response.status).toBe(503);
});

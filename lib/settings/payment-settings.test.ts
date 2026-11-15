import { describe, expect, it, vi } from "vitest";

import { EMPTY_PAYMENT_SETTINGS, parsePaymentSettings, savePaymentSettings, type PaymentSettings } from "./payment-settings";

const filled: PaymentSettings = { ...EMPTY_PAYMENT_SETTINGS, gcashNumber: "09171234567", gcashName: "Bren Raphael's" };
const ports = (before = EMPTY_PAYMENT_SETTINGS) => ({ read: vi.fn(async () => before), write: vi.fn(async () => {}), audit: vi.fn(async (_event: { actorId: string; detail: string }) => {}) });

describe("payment settings", () => {
  it("normalizes +63 numbers and bank account spacing", () => {
    const result = parsePaymentSettings({ ...EMPTY_PAYMENT_SETTINGS, gcashNumber: "+63 917 123 4567", bankAccountNumber: "1234-5678 90" });
    expect(result).toMatchObject({ ok: true, settings: { gcashNumber: "09171234567", bankAccountNumber: "1234567890" } });
  });
  it("rejects a bad number and says which field", () => {
    expect(parsePaymentSettings({ ...EMPTY_PAYMENT_SETTINGS, mayaNumber: "123" })).toMatchObject({ ok: false, error: expect.stringContaining("Maya number") });
  });
  it("lets an Admin save and logs the change with numbers masked", async () => {
    const p = ports();
    const result = await savePaymentSettings(p, { id: "u1", roleName: "Admin" }, filled);
    expect(result.ok).toBe(true);
    expect(p.write).toHaveBeenCalledWith(filled, "u1");
    expect(p.audit).toHaveBeenCalledWith({ actorId: "u1", detail: expect.stringContaining("…4567") });
    expect(p.audit.mock.calls[0][0].detail).not.toContain("0917123");
  });
  it("logs nothing when nothing changed", async () => {
    const p = ports(filled);
    await savePaymentSettings(p, { id: "u1", roleName: "Admin" }, filled);
    expect(p.write).not.toHaveBeenCalled();
    expect(p.audit).not.toHaveBeenCalled();
  });
  it.each(["CEO", "Manager", "Staff / Employee"])("refuses %s", async (roleName) => {
    const p = ports();
    expect(await savePaymentSettings(p, { id: "u2", roleName }, filled)).toMatchObject({ ok: false, status: 403 });
    expect(p.write).not.toHaveBeenCalled();
  });
});

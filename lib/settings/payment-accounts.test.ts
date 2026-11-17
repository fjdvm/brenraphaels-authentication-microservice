import { describe, expect, it, vi } from "vitest";

import {
  addPaymentAccount,
  editPaymentAccount,
  checkQrImage,
  parseAccountInput,
  removePaymentAccountQr,
  replacePaymentAccountQr,
  setPaymentAccountActive,
  withSignedQr,
  type PaymentAccount,
  type PaymentAccountPorts,
} from "./payment-accounts";

const gcash: PaymentAccount = { id: "a1", method: "GCASH", accountName: "Bren Raphael's", accountNumber: "09171234567", bankName: "", active: true };
const admin = { id: "u1", roleName: "Admin" };

function ports(existing: PaymentAccount[] = [gcash]) {
  const store = new Map(existing.map((account) => [account.id, account]));
  return {
    find: vi.fn(async (id: string) => store.get(id) ?? null),
    create: vi.fn(async (input) => ({ id: "new", active: true, bankName: "", ...input }) as PaymentAccount),
    update: vi.fn(async (id: string, input) => ({ ...store.get(id)!, ...input }) as PaymentAccount),
    setActive: vi.fn(async (id: string, active: boolean) => ({ ...store.get(id)!, active }) as PaymentAccount),
    setQrFileId: vi.fn(async (id: string, qrFileId: string | null) => ({ ...store.get(id)!, qrFileId }) as PaymentAccount),
    files: { upload: vi.fn(async () => "file-new"), remove: vi.fn(async (_id: string) => {}) },
    audit: vi.fn(async (_event: { actorId: string; action: string; detail: string }) => {}),
  } satisfies PaymentAccountPorts;
}

describe("parsing an account", () => {
  it("normalizes +63 numbers and bank account spacing", () => {
    expect(parseAccountInput({ method: "GCASH", accountName: " Bren  Raphael's ", accountNumber: "+63 917 123 4567" })).toMatchObject({
      ok: true, input: { accountName: "Bren Raphael's", accountNumber: "09171234567", bankName: "" },
    });
    expect(parseAccountInput({ method: "BANK", accountName: "Bren", accountNumber: "0042-8811 23", bankName: "BPI" })).toMatchObject({
      ok: true, input: { accountNumber: "004288112"+"3", bankName: "BPI" },
    });
  });
  it.each([
    [{ method: "WIRE", accountName: "x", accountNumber: "1" }, "method"],
    [{ method: "MAYA", accountName: "", accountNumber: "09171234567" }, "name"],
    [{ method: "MAYA", accountName: "x", accountNumber: "123" }, "11-digit"],
    [{ method: "BANK", accountName: "x", accountNumber: "123456", bankName: "" }, "Bank"],
    [{ method: "BANK", accountName: "x", accountNumber: "12", bankName: "BPI" }, "6 to 20 digits"],
  ])("rejects %j", (input, text) => {
    expect(parseAccountInput(input)).toMatchObject({ ok: false, error: expect.stringContaining(text) });
  });
  it("ignores a bank name on GCash and Maya", () => {
    expect(parseAccountInput({ method: "GCASH", accountName: "x", accountNumber: "09171234567", bankName: "BPI" })).toMatchObject({ ok: true, input: { bankName: "" } });
  });
});

describe("changing accounts", () => {
  it("lets an Admin add an account and logs it with the number masked", async () => {
    const p = ports();
    const result = await addPaymentAccount(p, admin, { method: "MAYA", accountName: "Second", accountNumber: "09181234567" });
    expect(result.ok).toBe(true);
    expect(p.create).toHaveBeenCalledWith({ method: "MAYA", accountName: "Second", accountNumber: "09181234567", bankName: "" }, "u1");
    expect(p.audit).toHaveBeenCalledWith({ actorId: "u1", action: "payment_account.create", detail: expect.stringContaining("…4567") });
    expect(p.audit.mock.calls[0][0].detail).not.toContain("0918123");
  });
  it("edits an account, logging only what changed, and keeps its method", async () => {
    const p = ports();
    const result = await editPaymentAccount(p, admin, "a1", { method: "GCASH", accountName: "Renamed", accountNumber: gcash.accountNumber });
    expect(result.ok).toBe(true);
    expect(p.update).toHaveBeenCalledWith("a1", { accountName: "Renamed", accountNumber: gcash.accountNumber, bankName: "" }, "u1");
    expect(p.audit.mock.calls[0][0]).toMatchObject({ action: "payment_account.update", detail: expect.stringContaining("Bren Raphael's → Renamed") });
  });
  it("refuses to change an account's method", async () => {
    const p = ports();
    expect(await editPaymentAccount(p, admin, "a1", { method: "MAYA", accountName: "x", accountNumber: gcash.accountNumber })).toMatchObject({ ok: false, status: 400 });
    expect(p.update).not.toHaveBeenCalled();
  });
  it("logs nothing when an edit changes nothing", async () => {
    const p = ports();
    await editPaymentAccount(p, admin, "a1", { method: "GCASH", accountName: gcash.accountName, accountNumber: gcash.accountNumber });
    expect(p.update).not.toHaveBeenCalled();
    expect(p.audit).not.toHaveBeenCalled();
  });
  it("deactivates and reactivates, logging each; repeating is a no-op", async () => {
    const p = ports();
    await setPaymentAccountActive(p, admin, "a1", false);
    expect(p.audit).toHaveBeenLastCalledWith({ actorId: "u1", action: "payment_account.deactivate", detail: expect.stringContaining("GCash") });
    await setPaymentAccountActive(ports([{ ...gcash, active: false }]), admin, "a1", false);
    const q = ports([{ ...gcash, active: false }]);
    await setPaymentAccountActive(q, admin, "a1", true);
    expect(q.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_account.reactivate" }));
    const r = ports();
    await setPaymentAccountActive(r, admin, "a1", true);
    expect(r.setActive).not.toHaveBeenCalled();
  });
  it("answers 404 for an unknown account", async () => {
    expect(await setPaymentAccountActive(ports(), admin, "nope", false)).toMatchObject({ ok: false, status: 404 });
  });
  it.each(["CEO", "Manager", "Staff / Employee"])("refuses %s on every change", async (roleName) => {
    const p = ports();
    const actor = { id: "u2", roleName };
    const input = { method: "GCASH", accountName: "x", accountNumber: "09171234567" };
    for (const result of [await addPaymentAccount(p, actor, input), await editPaymentAccount(p, actor, "a1", input), await setPaymentAccountActive(p, actor, "a1", false)]) {
      expect(result).toMatchObject({ ok: false, status: 403 });
    }
    expect(p.create.mock.calls.length + p.update.mock.calls.length + p.setActive.mock.calls.length + p.audit.mock.calls.length).toBe(0);
  });
});

const png = (size = 8) => ({ filename: "qr.png", contentType: "image/png", bytes: Uint8Array.from({ length: size }, (_, i) => [0x89, 0x50, 0x4e, 0x47][i] ?? 0) });

describe("QR images", () => {
  it("accepts a real PNG or JPG up to 2 MB", () => {
    expect(checkQrImage(png())).toBeNull();
    expect(checkQrImage({ filename: "q.jpg", contentType: "image/jpeg", bytes: Uint8Array.of(0xff, 0xd8, 0xff, 0xe0) })).toBeNull();
    expect(checkQrImage(png(2 * 1024 * 1024))).toBeNull();
  });
  it.each([
    ["a GIF", { filename: "q.gif", contentType: "image/gif", bytes: Uint8Array.of(1, 2, 3) }, "PNG or JPG"],
    ["a file renamed to PNG", { filename: "q.png", contentType: "image/png", bytes: Uint8Array.of(1, 2, 3, 4) }, "PNG or JPG"],
    ["an oversized image", png(2 * 1024 * 1024 + 1), "2 MB"],
    ["an empty file", { filename: "q.png", contentType: "image/png", bytes: new Uint8Array() }, "empty"],
  ])("refuses %s", (_name, image, words) => {
    expect(checkQrImage(image)).toContain(words);
  });

  it("stores the QR privately, drops the old File, and logs the replacement under the Admin", async () => {
    const p = ports([{ ...gcash, qrFileId: "file-old" }]);
    const result = await replacePaymentAccountQr(p, admin, "a1", png());
    expect(result).toMatchObject({ ok: true, account: { qrFileId: "file-new" } });
    expect(p.files.upload).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png" }), { entityType: "payment-account", entityId: "a1", role: "qr" });
    expect(p.files.remove).toHaveBeenCalledWith("file-old");
    expect(p.audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "u1", action: "payment_account.qr_replace", detail: expect.stringContaining("Replaced") }));
  });
  it("uploads nothing for a bad file or a CEO", async () => {
    const p = ports();
    expect(await replacePaymentAccountQr(p, admin, "a1", { ...png(), contentType: "image/gif" })).toMatchObject({ ok: false, status: 400 });
    expect(await replacePaymentAccountQr(p, { id: "c", roleName: "CEO" }, "a1", png())).toMatchObject({ ok: false, status: 403 });
    expect(p.files.upload).not.toHaveBeenCalled();
  });
  it("removes the new File when the account cannot be updated", async () => {
    const p = ports();
    p.setQrFileId.mockRejectedValueOnce(new Error("db down"));
    await expect(replacePaymentAccountQr(p, admin, "a1", png())).rejects.toThrow("db down");
    expect(p.files.remove).toHaveBeenCalledWith("file-new");
  });
  it("removes a QR and logs it; a CEO cannot", async () => {
    const p = ports([{ ...gcash, qrFileId: "file-old" }]);
    expect(await removePaymentAccountQr(p, { id: "c", roleName: "CEO" }, "a1")).toMatchObject({ status: 403 });
    expect(await removePaymentAccountQr(p, admin, "a1")).toMatchObject({ ok: true, account: { qrFileId: null } });
    expect(p.files.remove).toHaveBeenCalledWith("file-old");
    expect(p.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_account.qr_remove" }));
  });
  it("signs a fresh address per QR, never exposes the File id, and survives a signing failure", async () => {
    const viewUrl = vi.fn(async (id: string) => `https://files.test/${id}?sig=1`);
    const [withQr, without] = await withSignedQr([{ ...gcash, qrFileId: "f1" }, gcash], { viewUrl });
    expect(withQr).toMatchObject({ qrUrl: "https://files.test/f1?sig=1" });
    expect(withQr).not.toHaveProperty("qrFileId");
    expect(without.qrUrl).toBeNull();
    const [broken] = await withSignedQr([{ ...gcash, qrFileId: "f1" }], { viewUrl: async () => { throw new Error("down"); } });
    expect(broken.qrUrl).toBeNull();
  });
});

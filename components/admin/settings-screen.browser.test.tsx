// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentAccount } from "@/lib/settings/payment-accounts";

import { SettingsScreen } from "./settings-screen";

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { method: string; body: string }) => {
    const body = JSON.parse(init.body);
    sent.push({ url, method: init.method, body });
    const base = accounts.find((row) => url.endsWith(row.id));
    return Response.json({ ok: true, account: { id: base?.id ?? "new1", method: "GCASH", bankName: "", active: true, ...base, ...body } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const targets = { firstReplyHours: 24, resolveHours: 72 };
const accounts: PaymentAccount[] = [
  { id: "g1", method: "GCASH", accountName: "Bren Raphael's", accountNumber: "09175550142", bankName: "", active: true },
  { id: "m1", method: "MAYA", accountName: "Old Maya", accountNumber: "09175550143", bankName: "", active: false },
  { id: "b1", method: "BANK", accountName: "Bren Raphael's", accountNumber: "0042881123", bankName: "BPI", active: true },
];
const sent: { url: string; method: string; body: unknown }[] = [];

describe("Settings screen", () => {
  it("shows the General tab as an Admin: breadcrumb, Role pill, Approval limit only, Save changes", () => {
    render(<SettingsScreen accounts={accounts} canEdit centavos={500000} roleName="Admin" targets={targets} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Settings");
    expect(screen.getByText("/ General")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["General", "Payments", "Automatic checks", "Service levels"]);
    expect(screen.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Approval limit" })).toBeTruthy();
    expect(screen.getByText("Only an Admin can change this. Every change is logged. Requests keep the limit that applied when they were sent.")).toBeTruthy();
    expect((screen.getByLabelText("Limit in pesos") as HTMLInputElement).value).toBe("5000");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });

  it("shows the Service levels tab as an Admin with the two targets", async () => {
    render(<SettingsScreen accounts={accounts} canEdit centavos={500000} roleName="Admin" targets={targets} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Service levels" }));
    expect(screen.getByText("/ Service levels")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("SLA, triage & routing");
    expect((screen.getByLabelText("First reply target (hours)") as HTMLInputElement).value).toBe("24");
    expect((screen.getByLabelText("Resolve target (hours)") as HTMLInputElement).value).toBe("72");
    expect(screen.getAllByRole("button", { name: "Save changes" })).toHaveLength(1);
  });

  it("shows both tabs to a CEO read-only: values, no inputs, no Save", async () => {
    render(<SettingsScreen accounts={accounts} canEdit={false} centavos={500000} roleName="CEO" targets={targets} />);
    const user = userEvent.setup();
    expect(screen.getByText("CEO")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Limit in pesos" }).textContent).toBe("₱5,000");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Service levels" }));
    expect(screen.getByRole("group", { name: "First reply target (hours)" }).textContent).toBe("24");
    expect(screen.getByRole("group", { name: "Resolve target (hours)" }).textContent).toBe("72");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("shows the Payments tab to an Admin: accounts per method, add, edit, deactivate, reactivate, preview, one Save", async () => {
    render(<SettingsScreen accounts={accounts} canEdit centavos={500000} roleName="Admin" targets={targets} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Payments" }));
    expect(screen.getByText("/ Payments")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Payment details");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["GCash", "Maya", "Bank transfer", "Cash on Delivery", "What customers see"]);
    const preview = screen.getByRole("region", { name: "What customers see" });
    expect(preview.textContent).toContain("09175550142 · Bren Raphael's");
    expect(preview.textContent).toContain("No active account · checkout shows “ask us”");
    expect(preview.textContent).toContain("BPI 0042881123");
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeTruthy();

    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.clear(screen.getByLabelText("GCash account name"));
    await user.type(screen.getByLabelText("GCash account name"), "Renamed");
    await user.click(screen.getByRole("button", { name: "Add Maya account" }));
    const fresh = screen.getByRole("group", { name: "New Maya account" });
    await user.type(within(fresh).getByLabelText("Maya account name"), "Second Maya");
    await user.type(within(fresh).getByLabelText("Maya number"), "09181234567");
    expect(save.disabled).toBe(false);
    await user.click(save);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" }));
    await screen.findByText("Payment accounts saved. Customers see the active ones at checkout.");
    expect(sent.map((call) => [call.method, call.url])).toEqual([["PATCH", "/api/settings/payment-accounts/g1"], ["POST", "/api/settings/payment-accounts"]]);

    await user.click(screen.getAllByRole("button", { name: "Deactivate" })[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
    await screen.findByText(/deactivated\./);
    expect(sent.at(-1)).toMatchObject({ method: "PATCH", body: { active: false } });
  });

  it("shows the Payments tab to a CEO read-only: values, no add, edit, deactivate or Save", async () => {
    render(<SettingsScreen accounts={accounts} canEdit={false} centavos={500000} roleName="CEO" targets={targets} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Payments" }));
    expect(screen.getByRole("group", { name: "GCash number" }).textContent).toBe("09175550142");
    expect(screen.getByRole("region", { name: "What customers see" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    for (const name of [/^Add /, "Deactivate", "Reactivate", "Save changes"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });
});

describe("Payment account QR", () => {
  const withQr: PaymentAccount[] = [{ ...accounts[0], qrUrl: "https://files.test/f1?sig=abc" }, accounts[1], accounts[2]];

  it("lets an Admin upload, replace and remove a QR, each saved on its own", async () => {
    const calls: { url: string; method: string; file?: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { method: string; body?: FormData }) => {
      calls.push({ url, method: init.method, file: init.body?.get("file") });
      return Response.json({ ok: true, account: { ...accounts[2], qrUrl: init.method === "DELETE" ? null : "https://files.test/new?sig=1" } });
    }));
    render(<SettingsScreen accounts={withQr} canEdit centavos={500000} roleName="Admin" targets={targets} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Payments" }));
    expect(screen.getByRole("img", { name: "GCash QR" }).getAttribute("src")).toBe("https://files.test/f1?sig=abc");
    expect(screen.getByText("Replace QR")).toBeTruthy();
    const bank = within(screen.getByRole("group", { name: "InstaPay QR code" }));
    expect(bank.getByText("PNG or JPG · shown to customers to scan")).toBeTruthy();
    await user.upload(screen.getByLabelText("InstaPay QR code file"), new File([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], "q.png", { type: "image/png" }));
    await screen.findByText("Bank transfer QR saved.");
    expect(calls[0]).toMatchObject({ url: "/api/settings/payment-accounts/b1/qr", method: "POST" });
    expect(calls[0].file).toBeInstanceOf(File);
    await user.click(within(screen.getByRole("group", { name: "InstaPay QR code" })).getByRole("button", { name: "Remove" }));
    await screen.findByText("Bank transfer QR removed.");
    expect(calls[1]).toMatchObject({ method: "DELETE" });
  });

  it("refuses a wrong type or an oversized image before sending anything", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<SettingsScreen accounts={withQr} canEdit centavos={500000} roleName="Admin" targets={targets} />);
    const user = userEvent.setup({ applyAccept: false });
    await user.click(screen.getByRole("tab", { name: "Payments" }));
    await user.upload(screen.getByLabelText("GCash QR code file"), new File(["x"], "q.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert").textContent).toBe("The QR must be a PNG or JPG image.");
    await user.upload(screen.getByLabelText("GCash QR code file"), new File([new Uint8Array(2 * 1024 * 1024 + 1)], "q.png", { type: "image/png" }));
    expect(screen.getByRole("alert").textContent).toBe("The QR must be 2 MB or smaller.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a CEO the QR but no upload or remove control", async () => {
    render(<SettingsScreen accounts={withQr} canEdit={false} centavos={500000} roleName="CEO" targets={targets} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Payments" }));
    expect(screen.getByRole("img", { name: "GCash QR" })).toBeTruthy();
    expect(screen.queryByText(/Upload QR|Replace QR/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

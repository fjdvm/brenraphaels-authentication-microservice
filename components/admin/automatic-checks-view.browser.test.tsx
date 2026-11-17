// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AutomaticChecks } from "@/lib/settings/automatic-checks";

import { SettingsScreen } from "./settings-screen";

const checks: AutomaticChecks = {
  paymentProof: { reference: { enabled: true }, amount: { enabled: true }, date: { enabled: true }, recipient: { enabled: true } },
  cod: { firstOrder: { enabled: true }, firstOrderOverAmount: { enabled: true, amountInCentavos: 150000 }, earlierRefusal: { enabled: true }, earlierFailedDelivery: { enabled: true } },
  returns: { frequentReturns: { enabled: true, count: 3, days: 90 }, reusedPhoto: { enabled: true } },
  dashboard: { unverifiedPayments: { enabled: true, count: 5, waitHours: 24 }, returnSpike: { enabled: true, count: 3, days: 7 }, unresolvedFailedDeliveries: { enabled: true, count: 3 } },
};
const sent: { url: string; method: string; body: AutomaticChecks }[] = [];

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { method: string; body: string }) => {
    sent.push({ url, method: init.method, body: JSON.parse(init.body) });
    return Response.json({ ok: true });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const screenFor = (canEdit: boolean, roleName: string) =>
  render(<SettingsScreen accounts={[]} canEdit={canEdit} centavos={0} checks={checks} overdueUrl="https://crms.test/tickets?overdue=1" roleName={roleName} targets={null} />);

describe("Automatic checks tab", () => {
  it("shows the Figma groups and rules to an Admin, between Payments and Service levels", async () => {
    screenFor(true, "Admin");
    const user = userEvent.setup();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["General", "Payments", "Automatic checks", "Service levels"]);
    await user.click(screen.getByRole("tab", { name: "Automatic checks" }));
    expect(screen.getByText("/ Automatic checks")).toBeTruthy();
    for (const title of ["GCash payment proof", "Cash on delivery flags (shown to staff when confirming)", "Senior/PWD IDs", "Returns", "Dashboard alerts"]) {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    }
    expect(screen.getByText("Flag a reference number already used on another order")).toBeTruthy();
    expect(screen.queryByText(/Block a reference number/)).toBeNull();
    expect((screen.getByLabelText("First order amount in pesos") as HTMLInputElement).value).toBe("1500");
    expect(screen.getByRole("link", { name: "View overdue tickets" }).getAttribute("href")).toBe("https://crms.test/tickets?overdue=1");
  });

  it("shows the Senior/PWD duplicate-ID check on and locked, with no control", async () => {
    screenFor(true, "Admin");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Automatic checks" }));
    const section = screen.getByRole("heading", { name: "Senior/PWD IDs" }).closest("section")!;
    expect(section.querySelector("input")).toBeNull();
    expect(section.textContent).toContain("Always on");
  });

  it("saves a switched-off rule and an edited number, whole set, then confirms", async () => {
    screenFor(true, "Admin");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Automatic checks" }));
    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.click(screen.getByLabelText("Amount mismatch"));
    await user.clear(screen.getByLabelText("Days for returns"));
    await user.type(screen.getByLabelText("Days for returns"), "60");
    await user.click(save);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].url).toBe("/api/creoms/automatic-checks");
    expect(sent[0].method).toBe("PUT");
    expect(sent[0].body.paymentProof.amount.enabled).toBe(false);
    expect(sent[0].body.returns.frequentReturns.days).toBe(60);
    expect(sent[0].body.cod.earlierFailedDelivery.enabled).toBe(true);
    expect(sent[0].body.cod.firstOrderOverAmount.amountInCentavos).toBe(150000);
    expect(await screen.findByText("Automatic checks saved. The change is logged under your name.")).toBeTruthy();
  });

  it("refuses an invalid number before sending", async () => {
    screenFor(true, "Admin");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Automatic checks" }));
    await user.clear(screen.getByLabelText("Returns to flag"));
    await user.type(screen.getByLabelText("Returns to flag"), "0");
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it("shows a CEO the same values read-only: no inputs, checkboxes or Save", async () => {
    screenFor(false, "CEO");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Automatic checks" }));
    const panel = screen.getByRole("tabpanel", { name: "Automatic checks" });
    expect(panel.querySelector("input")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(panel.textContent).toContain("1,500");
  });
});

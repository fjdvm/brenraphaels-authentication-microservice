// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toCentavos } from "./approval-limit-form";
import { SettingsScreen } from "./settings-screen";

const screenFor = (canEdit: boolean) => <SettingsScreen canEdit={canEdit} centavos={500000} roleName={canEdit ? "Admin" : "CEO"} targets={{ firstReplyHours: 24, resolveHours: 72 }} />;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Approval limit setting", () => {
  it("parses pesos to centavos", () => {
    expect(toCentavos("5,000")).toBe(500000);
    expect(toCentavos("₱5000.01")).toBe(500001);
    expect(toCentavos("-1")).toBeNull();
    expect(toCentavos("abc")).toBeNull();
  });

  it("is read-only for anyone but an Admin", () => {
    render(screenFor(false));
    expect(screen.getByRole("group", { name: "Limit in pesos" }).textContent).toBe("₱5,000");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("confirms first, then waits for CREOMS before showing the new limit", async () => {
    const user = userEvent.setup();
    let finish!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(screenFor(true));

    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(screen.getByLabelText("Limit in pesos"));
    await user.type(screen.getByLabelText("Limit in pesos"), "7000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Change limit" }));
    expect(screen.getByRole("button", { name: /Saving/ })).toBeTruthy();
    expect(screen.queryByText(/Approval limit is now/)).toBeNull();
    finish(Response.json({ ok: true }));
    await waitFor(() => expect(screen.getByText("Approval limit is now ₱7,000.")).toBeTruthy());
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ amountInCentavos: 700000 });
  });

  it("says why when CREOMS refuses and keeps the old limit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Only an Admin can change the Approval limit." }, { status: 403 })));
    render(screenFor(true));
    await user.clear(screen.getByLabelText("Limit in pesos"));
    await user.type(screen.getByLabelText("Limit in pesos"), "100");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Change limit" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Only an Admin"));
    expect(screen.queryByText(/Approval limit is now/)).toBeNull();
  });
});

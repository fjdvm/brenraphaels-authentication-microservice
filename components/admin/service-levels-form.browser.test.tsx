// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toHours } from "./service-levels-form";
import { SettingsScreen } from "./settings-screen";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const screenFor = async (canEdit: boolean) => {
  render(<SettingsScreen accounts={[]} canEdit={canEdit} centavos={500000} roleName={canEdit ? "Admin" : "CEO"} targets={{ firstReplyHours: 24, resolveHours: 72 }} />);
  await userEvent.setup().click(screen.getByRole("tab", { name: "Service levels" }));
};

describe("Service levels setting", () => {
  it("parses whole hours", () => {
    expect(toHours("24")).toBe(24);
    expect(toHours("0")).toBeNull();
    expect(toHours("1.5")).toBeNull();
    expect(toHours("9000")).toBeNull();
  });

  it("is read-only for anyone but an Admin", async () => {
    await screenFor(false);
    expect(screen.getByRole("group", { name: "First reply target (hours)" }).textContent).toBe("24");
    expect(screen.getByRole("group", { name: "Resolve target (hours)" }).textContent).toBe("72");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("confirms first, then shows a spinner and waits for CREOMS before showing the new targets", async () => {
    const user = userEvent.setup();
    let finish!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    await screenFor(true);
    await user.clear(screen.getByLabelText("First reply target (hours)"));
    await user.type(screen.getByLabelText("First reply target (hours)"), "12");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Change service levels" }));
    expect(screen.getByRole("button", { name: /Saving/ })).toBeTruthy();
    expect(screen.queryByText(/Service levels are now/)).toBeNull();
    finish(Response.json({ ok: true }));
    await waitFor(() => expect(screen.getByText(/Service levels are now 12 h to first reply and 72 h to resolve/)).toBeTruthy());
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ firstReplyHours: 12, resolveHours: 72 });
  });

  it("says why when CREOMS refuses and keeps the old targets", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Only an Admin can change the Service levels." }, { status: 403 })));
    await screenFor(true);
    await user.clear(screen.getByLabelText("First reply target (hours)"));
    await user.type(screen.getByLabelText("First reply target (hours)"), "6");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Change service levels" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Only an Admin"));
    expect(screen.queryByText(/Service levels are now/)).toBeNull();
  });

  it("will not save a resolve target shorter than the first reply target", async () => {
    const user = userEvent.setup();
    await screenFor(true);
    await user.clear(screen.getByLabelText("Resolve target (hours)"));
    await user.type(screen.getByLabelText("Resolve target (hours)"), "5");
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceLevelsForm, toHours } from "./service-levels-form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const initial = { firstReplyHours: 24, resolveHours: 72 };

describe("Service levels setting", () => {
  it("parses whole hours", () => {
    expect(toHours("24")).toBe(24);
    expect(toHours("0")).toBeNull();
    expect(toHours("1.5")).toBeNull();
    expect(toHours("9000")).toBeNull();
  });

  it("is read-only for anyone but an Admin", () => {
    render(<ServiceLevelsForm canEdit={false} initial={initial} />);
    expect((screen.getByLabelText("First reply target (hours)") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save service levels" })).toBeNull();
  });

  it("confirms first, then shows a spinner and waits for CREOMS before showing the new targets", async () => {
    const user = userEvent.setup();
    let finish!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ServiceLevelsForm canEdit initial={initial} />);
    await user.clear(screen.getByLabelText("First reply target (hours)"));
    await user.type(screen.getByLabelText("First reply target (hours)"), "12");
    await user.click(screen.getByRole("button", { name: "Save service levels" }));
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
    render(<ServiceLevelsForm canEdit initial={initial} />);
    await user.clear(screen.getByLabelText("First reply target (hours)"));
    await user.type(screen.getByLabelText("First reply target (hours)"), "6");
    await user.click(screen.getByRole("button", { name: "Save service levels" }));
    await user.click(screen.getByRole("button", { name: "Change service levels" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Only an Admin"));
    expect(screen.queryByText(/Service levels are now/)).toBeNull();
  });

  it("will not save a resolve target shorter than the first reply target", async () => {
    const user = userEvent.setup();
    render(<ServiceLevelsForm canEdit initial={initial} />);
    await user.clear(screen.getByLabelText("Resolve target (hours)"));
    await user.type(screen.getByLabelText("Resolve target (hours)"), "5");
    expect((screen.getByRole("button", { name: "Save service levels" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

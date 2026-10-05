// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResendCredentialsButton } from "./resend-credentials-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(outcome: { status: "success" | "error"; message: string }, confirmed = true) {
  vi.spyOn(window, "confirm").mockReturnValue(confirmed);
  const action = vi.fn().mockResolvedValue(outcome);
  render(<ResendCredentialsButton action={action} username="2026-JD-001" />);
  return action;
}

describe("Resend credentials button", () => {
  it("confirms, resends and reports success without showing a password", async () => {
    const action = setup({ status: "success", message: "New credentials were emailed to 2026-JD-001." });

    await userEvent.setup().click(screen.getByRole("button", { name: /resend credentials/i }));

    expect(action).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole("status")).textContent).toContain("emailed to 2026-JD-001");
  });

  it("does nothing when the Administrator cancels", async () => {
    const action = setup({ status: "success", message: "x" }, false);

    await userEvent.setup().click(screen.getByRole("button", { name: /resend credentials/i }));

    expect(action).not.toHaveBeenCalled();
  });

  it("shows a failure as an alert, never as success", async () => {
    setup({ status: "error", message: "could not be emailed" });

    await userEvent.setup().click(screen.getByRole("button", { name: /resend credentials/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("could not be emailed");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

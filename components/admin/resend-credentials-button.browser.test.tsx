// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { ResendCredentialsButton } from "./resend-credentials-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("New credentials were emailed to 2026-JD-001."));
  });

  it("does nothing when the Administrator cancels", async () => {
    const action = setup({ status: "success", message: "x" }, false);

    await userEvent.setup().click(screen.getByRole("button", { name: /resend credentials/i }));

    expect(action).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a failure as an error toast, never as success", async () => {
    setup({ status: "error", message: "could not be emailed" });

    await userEvent.setup().click(screen.getByRole("button", { name: /resend credentials/i }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("could not be emailed"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a spinner at once and reports nothing until the server answers", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    type Outcome = { status: "success"; message: string };
    let settle: (outcome: Outcome) => void = () => {};
    const action = vi.fn(() => new Promise<Outcome>((resolve) => (settle = resolve)));
    render(<ResendCredentialsButton action={action} username="2026-JD-001" />);

    await userEvent.setup().click(screen.getByRole("button", { name: /resend credentials/i }));

    expect((screen.getByRole("button", { name: /resend credentials/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();

    await act(async () => settle({ status: "success", message: "New credentials were emailed to 2026-JD-001." }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("New credentials were emailed to 2026-JD-001."));
  });
});

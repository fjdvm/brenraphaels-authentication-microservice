// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/account", () => ({ updatePasswordAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { updatePasswordAction } from "@/actions/account";

import { UpdatePasswordForm } from "./update-password-form";

describe("UpdatePasswordForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("has Figma's three fields and the Update password button", () => {
    render(<UpdatePasswordForm />);

    expect(screen.getByLabelText("Current password")).toBeTruthy();
    expect(screen.getByLabelText("New password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm new password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update password" })).toBeTruthy();
  });

  it("ticks the requirement chips as the new password meets them", async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);
    const met = () => screen.getAllByRole("listitem").filter((chip) => chip.getAttribute("data-met") === "true").map((c) => c.textContent);

    expect(met()).toEqual([]);

    await user.type(screen.getByLabelText("New password"), "Passw0rd12");

    expect(met()).toEqual(["8+ characters", "Uppercase letter", "Number"]);
  });

  it("shows the problem the server reports as an error toast and keeps what was typed", async () => {
    vi.mocked(updatePasswordAction).mockResolvedValue({ error: "Your current password is incorrect." });
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "wrong-pass");
    await user.type(screen.getByLabelText("New password"), "Passw0rd12");
    await user.type(screen.getByLabelText("Confirm new password"), "Passw0rd12");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Your current password is incorrect."));
    expect(toast.success).not.toHaveBeenCalled();
    expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("Passw0rd12");
  });

  it("confirms a saved password with a success toast and empties the fields", async () => {
    vi.mocked(updatePasswordAction).mockResolvedValue({ error: null, message: "Your password was updated." });
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(screen.getByLabelText("New password"), "Passw0rd12");
    await user.type(screen.getByLabelText("Confirm new password"), "Passw0rd12");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Your password was updated."));
    await vi.waitFor(() => expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe(""));
  });
});

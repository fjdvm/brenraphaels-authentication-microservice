// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserLifecycleButton } from "./user-lifecycle-button";

afterEach(cleanup);

describe("User lifecycle button", () => {
  it("asks for confirmation in a dialog before deleting, then confirms with the User id and closes", async () => {
    const onConfirm = vi.fn();
    render(<UserLifecycleButton mode="delete" name="Jane Doe" onConfirm={onConfirm} userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    expect(onConfirm).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog", { name: "Delete Jane Doe?" }));
    expect(dialog.getByText(/2026-JD-001 will no longer be able to log in/)).toBeTruthy();
    const signOut = dialog.getByRole("checkbox", { name: "Sign them out of every system now" }) as HTMLInputElement;
    expect(signOut.checked && signOut.disabled).toBe(true);
    await userEvent.click(dialog.getByRole("button", { name: "Delete user" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("u1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the Administrator cancel a delete", async () => {
    const onConfirm = vi.fn();
    render(<UserLifecycleButton mode="delete" name="Jane Doe" onConfirm={onConfirm} userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("restores in one click", async () => {
    const onConfirm = vi.fn();
    render(<UserLifecycleButton mode="restore" name="Jane Doe" onConfirm={onConfirm} userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Restore 2026-JD-001" }));

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("u1");
  });
});

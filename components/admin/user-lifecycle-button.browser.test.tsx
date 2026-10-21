// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";

import { UserLifecycleButton } from "./user-lifecycle-button";

type Action = (previous: LifecycleFormState, data: FormData) => Promise<LifecycleFormState>;

afterEach(cleanup);

describe("User lifecycle button", () => {
  it("asks for confirmation in a dialog before deleting, then submits the User id", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ error: null });
    render(<UserLifecycleButton action={action} mode="delete" name="Jane Doe" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    expect(action).not.toHaveBeenCalled();

    const dialog = within(screen.getByRole("dialog", { name: "Delete Jane Doe?" }));
    expect(dialog.getByText(/2026-JD-001 will no longer be able to log in/)).toBeTruthy();
    const signOut = dialog.getByRole("checkbox", { name: "Sign them out of every system now" }) as HTMLInputElement;
    expect(signOut.checked && signOut.disabled).toBe(true);
    await userEvent.click(dialog.getByRole("button", { name: "Delete user" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect((action.mock.calls[0][1] as FormData).get("userId")).toBe("u1");
  });

  it("lets the Administrator cancel a delete", async () => {
    const action = vi.fn<Action>();
    render(<UserLifecycleButton action={action} mode="delete" name="Jane Doe" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows a refused delete", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ error: "Super Admins cannot be deleted." });
    render(<UserLifecycleButton action={action} mode="delete" name="Jane Doe" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete user" }));

    const dialog = within(screen.getByRole("dialog", { name: "Delete Jane Doe?" }));
    expect((await dialog.findByRole("alert")).textContent).toBe("Super Admins cannot be deleted.");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays open while the delete is in flight", async () => {
    let finish: (state: LifecycleFormState) => void = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (finish = resolve)));
    render(<UserLifecycleButton action={action} mode="delete" name="Jane Doe" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete user" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Delete Jane Doe?" })).toBeTruthy();
    finish({ error: "Super Admins cannot be deleted." });
    expect((await screen.findByRole("alert")).textContent).toBe("Super Admins cannot be deleted.");
  });

  it("restores in one click and shows a refusal", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ error: "You are not allowed to manage Users." });
    render(<UserLifecycleButton action={action} mode="restore" name="Jane Doe" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Restore 2026-JD-001" }));

    expect((await screen.findByRole("alert")).textContent).toBe("You are not allowed to manage Users.");
  });
});

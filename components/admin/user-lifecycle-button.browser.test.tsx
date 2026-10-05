// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";

import { UserLifecycleButton } from "./user-lifecycle-button";

type Action = (previous: LifecycleFormState, data: FormData) => Promise<LifecycleFormState>;

afterEach(cleanup);

describe("User lifecycle button", () => {
  it("asks for confirmation before deleting, then submits the User id", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ error: null });
    render(<UserLifecycleButton action={action} mode="delete" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirm delete 2026-JD-001" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect((action.mock.calls[0][1] as FormData).get("userId")).toBe("u1");
  });

  it("lets the Administrator cancel a delete", async () => {
    const action = vi.fn<Action>();
    render(<UserLifecycleButton action={action} mode="delete" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Delete 2026-JD-001" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete 2026-JD-001" })).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("restores in one click and shows a refusal", async () => {
    const action = vi.fn<Action>().mockResolvedValue({ error: "You are not allowed to manage Users." });
    render(<UserLifecycleButton action={action} mode="restore" userId="u1" username="2026-JD-001" />);

    await userEvent.click(screen.getByRole("button", { name: "Restore 2026-JD-001" }));

    expect((await screen.findByRole("alert")).textContent).toBe("You are not allowed to manage Users.");
  });
});

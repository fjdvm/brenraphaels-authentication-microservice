// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManagedUser } from "@/lib/admin/user-directory";
import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";

import { UserDirectory } from "./user-directory";

type Action = (previous: LifecycleFormState, data: FormData) => Promise<LifecycleFormState>;

const user = (overrides: Partial<ManagedUser> & Pick<ManagedUser, "id" | "username">): ManagedUser => ({
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: `${overrides.username.toLowerCase()}@example.com`,
  roleName: "Staff / Employee",
  isAdministrator: false,
  status: "Active",
  mustChangePassword: false,
  ...overrides,
});

const admin = user({ id: "u1", username: "2026-ADMIN-001", roleName: "Admin", isAdministrator: true });
const staff = user({ id: "u3", username: "2026-FM-003", firstName: "Fitz", lastName: "Martin" });
const newcomer = user({ id: "u5", username: "2026-NC-005", status: "Awaiting first login", mustChangePassword: true });
const deleted = user({ id: "u4", username: "2026-AB-004", firstName: "Ana", lastName: "Bautista", status: "Deleted" });
const deletedNewcomer = user({ id: "u6", username: "2026-DN-006", status: "Deleted", mustChangePassword: true });

/** Actions still hanging when a test ends; React entangles transitions, so they must not leak into the next test. */
const open: Array<(state: LifecycleFormState) => void> = [];

/** A fake Server Action the test settles by hand, to see the screen while it is pending. */
function hangingAction() {
  let settle: (state: LifecycleFormState) => void = () => {};
  const action = vi.fn<Action>(() => new Promise((resolve) => open.push((settle = resolve))));

  return { action, settle: (state: LifecycleFormState) => settle(state) };
}

function renderDirectory(overrides: { remove?: Action; restore?: Action } = {}) {
  const actions = {
    resend: vi.fn(async () => ({ status: "success" as const, message: "Sent" })),
    remove: overrides.remove ?? vi.fn<Action>(async () => ({ error: null })),
    restore: overrides.restore ?? vi.fn<Action>(async () => ({ error: null })),
  };

  const view = (users: ManagedUser[]) => <UserDirectory actions={actions} signedInUserId="u1" canWrite users={users} />;
  const { rerender } = render(view([admin, staff, newcomer, deleted, deletedNewcomer]));

  return { showConfirmed: (users: ManagedUser[]) => rerender(view(users)) };
}

const row = (username: string) => screen.getByRole("row", { name: new RegExp(username) });
const summary = (label: string) => within(screen.getByRole("list", { name: "User summary" })).getByText(label).nextSibling?.textContent;

async function confirmDelete(username: string) {
  await userEvent.click(within(row(username)).getByRole("button", { name: `Delete ${username}` }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete user" }));
}

afterEach(async () => {
  await act(async () => open.splice(0).forEach((settle) => settle({ error: null })));
  cleanup();
});

describe("Deleting a User", () => {
  it("shows the User as Deleted and closes the dialog while the server is still working", async () => {
    const { action } = hangingAction();
    renderDirectory({ remove: action });

    await confirmDelete("2026-FM-003");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(row("2026-FM-003")).getByText("Deleted")).toBeTruthy();
    expect(within(row("2026-FM-003")).getByRole("button", { name: "Restore 2026-FM-003" })).toBeTruthy();
    expect(summary("Deleted")).toBe("3");
    expect(summary("Active")).toBe("2");
  });

  it("keeps the User Deleted, with no alert, once the server confirms and the list refreshes", async () => {
    const { action, settle } = hangingAction();
    const { showConfirmed } = renderDirectory({ remove: action });

    await confirmDelete("2026-FM-003");
    await act(async () => {
      settle({ error: null });
      showConfirmed([admin, { ...staff, status: "Deleted" }, newcomer, deleted, deletedNewcomer]);
    });

    expect(within(row("2026-FM-003")).getByText("Deleted")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rolls the User back and says why when the server refuses", async () => {
    const { action, settle } = hangingAction();
    renderDirectory({ remove: action });

    await confirmDelete("2026-FM-003");
    settle({ error: "You are not allowed to manage Users." });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("2026-FM-003");
    expect(alert.textContent).toContain("You are not allowed to manage Users.");
    expect(within(row("2026-FM-003")).queryByText("Deleted")).toBeNull();
    expect(within(row("2026-FM-003")).getByRole("button", { name: "Delete 2026-FM-003" })).toBeTruthy();
    expect(summary("Deleted")).toBe("2");
  });

  it("rolls back and reports when the request fails outright", async () => {
    renderDirectory({ remove: vi.fn<Action>().mockRejectedValue(new Error("network")) });

    await confirmDelete("2026-FM-003");

    expect((await screen.findByRole("alert")).textContent).toContain("2026-FM-003");
    expect(within(row("2026-FM-003")).queryByText("Deleted")).toBeNull();
  });

  it("keeps the delete confirmation: nothing changes before the Administrator confirms", async () => {
    const { action } = hangingAction();
    renderDirectory({ remove: action });

    await userEvent.click(within(row("2026-FM-003")).getByRole("button", { name: "Delete 2026-FM-003" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(within(row("2026-FM-003")).queryByText("Deleted")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
});

describe("Restoring a User", () => {
  it("shows the User as live again while the server is still working", async () => {
    const { action } = hangingAction();
    renderDirectory({ restore: action });

    await userEvent.click(within(row("2026-AB-004")).getByRole("button", { name: "Restore 2026-AB-004" }));

    expect(within(row("2026-AB-004")).getByText("Active")).toBeTruthy();
    expect(within(row("2026-AB-004")).getByRole("button", { name: "Delete 2026-AB-004" })).toBeTruthy();
    expect(summary("Deleted")).toBe("1");
  });

  it("restores a User who never signed in to Awaiting first login", async () => {
    const { action } = hangingAction();
    renderDirectory({ restore: action });

    await userEvent.click(within(row("2026-DN-006")).getByRole("button", { name: "Restore 2026-DN-006" }));

    expect(within(row("2026-DN-006")).getByText("Awaiting first login")).toBeTruthy();
  });

  it("rolls the User back and says why when the server refuses", async () => {
    const { action, settle } = hangingAction();
    renderDirectory({ restore: action });

    await userEvent.click(within(row("2026-AB-004")).getByRole("button", { name: "Restore 2026-AB-004" }));
    settle({ error: "You are not allowed to manage Users." });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("2026-AB-004");
    expect(alert.textContent).toContain("You are not allowed to manage Users.");
    expect(within(row("2026-AB-004")).getByText("Deleted")).toBeTruthy();
    expect(within(row("2026-AB-004")).getByRole("button", { name: "Restore 2026-AB-004" })).toBeTruthy();
  });

  it("clears an earlier refusal when the Administrator tries again", async () => {
    const restore = vi
      .fn<Action>()
      .mockResolvedValueOnce({ error: "You are not allowed to manage Users." })
      .mockImplementationOnce(() => new Promise((resolve) => open.push(resolve)));
    renderDirectory({ restore });

    await userEvent.click(within(row("2026-AB-004")).getByRole("button", { name: "Restore 2026-AB-004" }));
    await screen.findByRole("alert");
    await userEvent.click(within(row("2026-AB-004")).getByRole("button", { name: "Restore 2026-AB-004" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

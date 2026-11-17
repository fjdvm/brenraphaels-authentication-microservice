// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditUserAccessFormState } from "@/lib/admin/user-access-form-state";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { EditUserAccessForm } from "./edit-user-access-form";

const roles = [
  { id: "r-cashier", name: "Cashier" },
  { id: "r-ceo", name: "CEO" },
];

const systems = [
  { id: "s-pos", name: "POS", modules: [{ id: "p-dash", name: "Dashboard" }, { id: "p-sales", name: "Sales Processing" }] },
  { id: "s-crms", name: "CRMS", modules: [{ id: "c-dash", name: "Dashboard" }] },
];

const user = {
  id: "u-1",
  roleId: "r-cashier",
  activeModuleIds: ["p-sales"],
  firstName: "Juan",
  lastName: "Dela Cruz",
  username: "2026-JD-001",
  isDeleted: false,
};

function renderForm(
  result: EditUserAccessFormState = { error: null, saved: true, fieldErrors: {} },
  overrides: Partial<typeof user> = {},
) {
  const action = vi.fn<(previous: EditUserAccessFormState, data: FormData) => Promise<EditUserAccessFormState>>();
  action.mockResolvedValue(result);
  render(<EditUserAccessForm action={action} roles={roles} systems={systems} user={{ ...user, ...overrides }} />);
  return action;
}

const group = (name: string) => within(screen.getByRole("group", { name }));
const box = (system: string, name: string) => group(system).getByRole("checkbox", { name }) as HTMLInputElement;

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("Edit user access form", () => {
  it("opens as the Edit access dialog naming the User, their Username and Role", () => {
    renderForm();

    const dialog = within(screen.getByRole("dialog", { name: "Edit access · Juan Dela Cruz" }));
    expect(dialog.getByText(/2026-JD-001 · Cashier\. Changes apply the next time they open a system\./)).toBeTruthy();
    expect(group("POS").getByText("1 of 2")).toBeTruthy();
  });

  it("returns to User management when cancelled or closed", async () => {
    const person = userEvent.setup();
    renderForm();

    await person.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenLastCalledWith("/admin/users", { scroll: false });

    push.mockReset();
    await person.click(screen.getByRole("button", { name: "Close" }));
    expect(push).toHaveBeenLastCalledWith("/admin/users", { scroll: false });
  });

  it("refuses to edit a Deleted User until they are restored", () => {
    renderForm(undefined, { isDeleted: true });

    expect(screen.getByRole("status").textContent).toContain("restored");
    expect(screen.queryByRole("button", { name: /save access/i })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("stays open while the save is in flight", async () => {
    const person = userEvent.setup();
    let finish: (state: EditUserAccessFormState) => void = () => {};
    const action = vi.fn<(previous: EditUserAccessFormState, data: FormData) => Promise<EditUserAccessFormState>>(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<EditUserAccessForm action={action} roles={roles} systems={systems} user={user} />);

    await person.click(screen.getByRole("button", { name: /save access/i }));
    await person.keyboard("{Escape}");

    expect(push).not.toHaveBeenCalled();
    finish({ error: null, saved: true, fieldErrors: {} });
    expect((await screen.findByRole("status")).textContent).toContain("Access saved");
  });

  it("shows a spinner at once and no earlier result while a second save is pending", async () => {
    const person = userEvent.setup();
    const saved: EditUserAccessFormState = { error: null, saved: true, fieldErrors: {} };
    const action = vi.fn<(previous: EditUserAccessFormState, data: FormData) => Promise<EditUserAccessFormState>>();
    let finish: (state: EditUserAccessFormState) => void = () => {};
    action.mockResolvedValueOnce(saved).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<EditUserAccessForm action={action} roles={roles} systems={systems} user={user} />);

    await person.click(screen.getByRole("button", { name: /save access/i }));
    expect((await screen.findByRole("status")).textContent).toContain("Access saved");

    await person.click(box("CREOMS", "Dashboard"));
    await person.click(screen.getByRole("button", { name: /save access/i }));

    expect((screen.getByRole("button", { name: /saving/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();

    finish({ error: null, saved: true, fieldErrors: {} });
    expect((await screen.findByRole("status")).textContent).toContain("Access saved");
  });

  it("does not show the previous error while a retry is pending", async () => {
    const person = userEvent.setup();
    const failed: EditUserAccessFormState = { error: "The changes were not saved.", saved: false, fieldErrors: {} };
    const action = vi.fn<(previous: EditUserAccessFormState, data: FormData) => Promise<EditUserAccessFormState>>();
    let finish: (state: EditUserAccessFormState) => void = () => {};
    action.mockResolvedValueOnce(failed).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<EditUserAccessForm action={action} roles={roles} systems={systems} user={user} />);

    await person.click(screen.getByRole("button", { name: /save access/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("not saved");
    await person.click(screen.getByRole("button", { name: /save access/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    finish({ error: null, saved: true, fieldErrors: {} });
    expect((await screen.findByRole("status")).textContent).toContain("Access saved");
  });

  it("stops saying Access saved once the Administrator edits again", async () => {
    const person = userEvent.setup();
    renderForm();

    await person.click(screen.getByRole("button", { name: /save access/i }));
    expect((await screen.findByRole("status")).textContent).toContain("Access saved");

    await person.click(box("CREOMS", "Dashboard"));

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the User's current grants grouped by System with Select all", () => {
    renderForm();

    expect(box("POS", "Sales Processing").checked).toBe(true);
    expect(box("POS", "Dashboard").checked).toBe(false);
    expect(box("CREOMS", "Dashboard").checked).toBe(false);
    expect(box("POS", "Select all")).toBeTruthy();
  });

  it("Select all checks only that System", async () => {
    const person = userEvent.setup();
    renderForm();

    await person.click(box("CREOMS", "Select all"));

    expect(box("CREOMS", "Dashboard").checked).toBe(true);
    expect(box("POS", "Dashboard").checked).toBe(false);
  });

  it("changing the Role does not change the checked Modules", async () => {
    const person = userEvent.setup();
    renderForm();

    await person.selectOptions(screen.getByRole("combobox", { name: "Role" }), "r-ceo");

    expect(box("POS", "Sales Processing").checked).toBe(true);
    expect(box("POS", "Dashboard").checked).toBe(false);
  });

  it("submits the User, Role and complete Module selection, then confirms", async () => {
    const person = userEvent.setup();
    const action = renderForm();

    await person.click(box("POS", "Dashboard"));
    await person.click(box("POS", "Sales Processing"));
    await person.selectOptions(screen.getByRole("combobox", { name: "Role" }), "r-ceo");
    await person.click(screen.getByRole("button", { name: /save access/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("userId")).toBe("u-1");
    expect(data.get("roleId")).toBe("r-ceo");
    expect(data.getAll("moduleIds")).toEqual(["p-dash"]);
    expect((await screen.findByRole("status")).textContent).toContain("Access saved");
  });

  it("keeps the Administrator's edits and shows the error when saving fails", async () => {
    const person = userEvent.setup();
    renderForm({ error: "The changes were not saved. Reload the page and try again.", saved: false, fieldErrors: {} });

    await person.click(box("CREOMS", "Dashboard"));
    await person.click(screen.getByRole("button", { name: /save access/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("not saved");
    expect(box("CREOMS", "Dashboard").checked).toBe(true);
  });
});

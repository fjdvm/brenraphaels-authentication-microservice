// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditUserAccessFormState } from "@/lib/admin/user-access-form-state";

import { EditUserAccessForm } from "./edit-user-access-form";

const roles = [
  { id: "r-cashier", name: "Cashier" },
  { id: "r-ceo", name: "CEO" },
];

const systems = [
  { id: "s-pos", name: "POS", modules: [{ id: "p-dash", name: "Dashboard" }, { id: "p-sales", name: "Sales Processing" }] },
  { id: "s-crms", name: "CRMS", modules: [{ id: "c-dash", name: "Dashboard" }] },
];

const user = { id: "u-1", roleId: "r-cashier", activeModuleIds: ["p-sales"] };

function renderForm(result: EditUserAccessFormState = { error: null, saved: true, fieldErrors: {} }) {
  const action = vi.fn<(previous: EditUserAccessFormState, data: FormData) => Promise<EditUserAccessFormState>>();
  action.mockResolvedValue(result);
  render(<EditUserAccessForm action={action} roles={roles} systems={systems} user={user} />);
  return action;
}

const group = (name: string) => within(screen.getByRole("group", { name }));
const box = (system: string, name: string) => group(system).getByRole("checkbox", { name }) as HTMLInputElement;

afterEach(cleanup);

describe("Edit user access form", () => {
  it("shows the User's current grants grouped by System with Select all", () => {
    renderForm();

    expect(box("POS", "Sales Processing").checked).toBe(true);
    expect(box("POS", "Dashboard").checked).toBe(false);
    expect(box("CRMS", "Dashboard").checked).toBe(false);
    expect(box("POS", "Select all")).toBeTruthy();
  });

  it("Select all checks only that System", async () => {
    const person = userEvent.setup();
    renderForm();

    await person.click(box("CRMS", "Select all"));

    expect(box("CRMS", "Dashboard").checked).toBe(true);
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

    await person.click(box("CRMS", "Dashboard"));
    await person.click(screen.getByRole("button", { name: /save access/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("not saved");
    expect(box("CRMS", "Dashboard").checked).toBe(true);
  });
});

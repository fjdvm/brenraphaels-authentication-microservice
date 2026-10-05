// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateUserFormState } from "@/lib/admin/user-form-state";

import { CreateUserForm } from "./create-user-form";

const roles = [
  { id: "r-cashier", name: "Cashier", templateModuleIds: ["p-sales"] },
  { id: "r-blank", name: "VP", templateModuleIds: [] },
];

const systems = [
  { id: "s-pos", name: "POS", modules: [{ id: "p-dash", name: "Dashboard" }, { id: "p-sales", name: "Sales Processing" }] },
  { id: "s-crms", name: "CRMS", modules: [{ id: "c-dash", name: "Dashboard" }] },
];

function renderForm(action = vi.fn<(previous: CreateUserFormState, data: FormData) => Promise<CreateUserFormState>>()) {
  action.mockResolvedValue({ error: null, fieldErrors: {} });
  render(<CreateUserForm action={action} roles={roles} systems={systems} />);
  return action;
}

function systemGroup(name: string) {
  return within(screen.getByRole("group", { name }));
}

afterEach(cleanup);

describe("Create user form", () => {
  it("groups Module checkboxes under each System with a Select all", () => {
    renderForm();

    expect(systemGroup("POS").getByRole("checkbox", { name: "Dashboard" })).toBeTruthy();
    expect(systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" })).toBeTruthy();
    expect(systemGroup("CRMS").getByRole("checkbox", { name: "Dashboard" })).toBeTruthy();
    expect(systemGroup("POS").getByRole("checkbox", { name: "Select all" })).toBeTruthy();
  });

  it("Select all checks only that System's Modules", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(systemGroup("POS").getByRole("checkbox", { name: "Select all" }));

    expect((systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
    expect((systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement).checked).toBe(true);
    expect((systemGroup("CRMS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(false);
  });

  it("pre-checks the Role's AccessTemplate and keeps every box editable", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Role"), "r-cashier");

    const sales = systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement;
    expect(sales.checked).toBe(true);
    expect((systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(false);

    await user.click(sales);
    await user.click(systemGroup("CRMS").getByRole("checkbox", { name: "Dashboard" }));

    expect(sales.checked).toBe(false);
    expect((systemGroup("CRMS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
  });

  it("submits the entered details and the final Module selection", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.type(screen.getByLabelText("First name"), "Juan");
    await user.type(screen.getByLabelText("Last name"), "Dela Cruz");
    await user.type(screen.getByLabelText("Email"), "juan@example.com");
    await user.selectOptions(screen.getByLabelText("Role"), "r-cashier");
    await user.click(systemGroup("CRMS").getByRole("checkbox", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0][1];
    expect(data.get("firstName")).toBe("Juan");
    expect(data.get("lastName")).toBe("Dela Cruz");
    expect(data.get("email")).toBe("juan@example.com");
    expect(data.get("roleId")).toBe("r-cashier");
    expect(data.getAll("moduleIds").sort()).toEqual(["c-dash", "p-sales"]);
  });

  it("keeps every entry and shows actionable errors after a failure", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({
      error: "Check the highlighted fields and try again.",
      fieldErrors: { email: "A User with this Email already exists. Use a different Email." },
    });
    render(<CreateUserForm action={action} roles={roles} systems={systems} />);

    await user.type(screen.getByLabelText("First name"), "Juan");
    await user.type(screen.getByLabelText("Last name"), "Dela Cruz");
    await user.type(screen.getByLabelText("Email"), "juan@example.com");
    await user.selectOptions(screen.getByLabelText("Role"), "r-cashier");
    await user.click(systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }));
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByText(/already exists/i)).toBeTruthy();
    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Juan");
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe("Dela Cruz");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("juan@example.com");
    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("r-cashier");
    expect((systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
    expect((systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement).checked).toBe(true);
  });

  it("never offers a password field", () => {
    renderForm();

    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});

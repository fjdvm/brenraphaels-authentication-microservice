// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateUserFormState } from "@/lib/admin/user-form-state";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { CreateUserForm } from "./create-user-form";

const roles = [
  { id: "r-general-manager", name: "General Manager", templateModuleIds: ["p-dash", "p-sales", "c-dash"] },
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Create user form", () => {
  it("groups Module checkboxes under each System with a Select all", () => {
    renderForm();

    expect(systemGroup("POS").getByRole("checkbox", { name: "Dashboard" })).toBeTruthy();
    expect(systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" })).toBeTruthy();
    expect(systemGroup("CREOMS").getByRole("checkbox", { name: "Dashboard" })).toBeTruthy();
    expect(systemGroup("POS").getByRole("checkbox", { name: "Select all" })).toBeTruthy();
  });

  it("shows no card for a System that has no Modules", () => {
    render(<CreateUserForm action={vi.fn()} roles={roles} systems={[...systems, { id: "s-ecom", name: "Ecommerce", modules: [] }]} />);

    expect(screen.queryByRole("group", { name: "Ecommerce" })).toBeNull();
    expect(screen.queryByText("0 of 0")).toBeNull();
    expect(screen.getByRole("group", { name: "POS" })).toBeTruthy();
  });

  it("Select all checks only that System's Modules", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(systemGroup("POS").getByRole("checkbox", { name: "Select all" }));

    expect((systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
    expect((systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement).checked).toBe(true);
    expect((systemGroup("CREOMS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(false);
  });

  it("pre-checks the Role's AccessTemplate and keeps every box editable", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Role"), "r-cashier");

    const sales = systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement;
    expect(sales.checked).toBe(true);
    expect((systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(false);

    await user.click(sales);
    await user.click(systemGroup("CREOMS").getByRole("checkbox", { name: "Dashboard" }));

    expect(sales.checked).toBe(false);
    expect((systemGroup("CREOMS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
  });

  it("pre-checks every System for General Manager and lets the Administrator untick a Module", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText("Role"), "r-general-manager");
    const sales = systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement;
    expect(sales.checked).toBe(true);
    expect((systemGroup("POS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
    expect((systemGroup("CREOMS").getByRole("checkbox", { name: "Dashboard" }) as HTMLInputElement).checked).toBe(true);
    await user.click(sales);
    expect(sales.checked).toBe(false);
  });

  it("submits the entered details and the final Module selection", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.type(screen.getByLabelText("First name"), "Juan");
    await user.type(screen.getByLabelText("Last name"), "Dela Cruz");
    await user.type(screen.getByLabelText("Email"), "juan@example.com");
    await user.selectOptions(screen.getByLabelText("Role"), "r-cashier");
    await user.click(systemGroup("CREOMS").getByRole("checkbox", { name: "Select all" }));
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

  it("shows a spinner at once and toasts each failure only when the server answers", async () => {
    const user = userEvent.setup();
    const action = vi.fn<(previous: CreateUserFormState, data: FormData) => Promise<CreateUserFormState>>();
    let finish: (state: CreateUserFormState) => void = () => {};
    action
      .mockResolvedValueOnce({ error: "Check the highlighted fields and try again.", fieldErrors: {} })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<CreateUserForm action={action} roles={roles} systems={systems} />);

    await user.click(screen.getByRole("button", { name: /create user/i }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Check the highlighted fields and try again."));
    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect((screen.getByRole("button", { name: /creating/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);

    finish({ error: "The email could not be sent.", fieldErrors: {} });
    await vi.waitFor(() => expect(toast.error).toHaveBeenLastCalledWith("The email could not be sent."));
  });

  it("counts each System's ticked Modules and marks a partial Select all", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByText("0 modules selected across 0 systems")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Role"), "r-cashier");

    expect(systemGroup("POS").getByText("1 of 2")).toBeTruthy();
    expect(systemGroup("CREOMS").getByText("0 of 1")).toBeTruthy();
    const posSelectAll = systemGroup("POS").getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;
    expect(posSelectAll.indeterminate).toBe(true);
    expect(screen.getByText("1 module selected across 1 system")).toBeTruthy();

    await user.click(systemGroup("CREOMS").getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByText("2 modules selected across 2 systems")).toBeTruthy();
  });

  it("lists the Roles and marks every field as required", () => {
    renderForm();

    expect(screen.getByText("Roles: General Manager, Cashier, VP")).toBeTruthy();
    for (const label of ["First name", "Last name", "Email", "Role"]) {
      expect(screen.getByLabelText(label).getAttribute("aria-required")).toBe("true");
    }
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/admin/users");
  });

  it("never offers a password field", () => {
    renderForm();

    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  describe("from an Account request", () => {
    const request = { id: "rq", reference: "RQ-0014", requesterName: "Ana T.", note: "Only sales", firstName: "Carla", lastName: "Domingo", email: "carla@x.ph", roleId: "r-cashier", moduleIds: ["p-sales"] };
    const open = (action = vi.fn<(previous: CreateUserFormState, data: FormData) => Promise<CreateUserFormState>>().mockResolvedValue({ error: null, fieldErrors: {} })) => {
      render(<CreateUserForm action={action} request={request} roles={roles} systems={systems} />);
      return action;
    };

    it("prefills name, email, Role and the ticked Modules", () => {
      open();
      expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Carla");
      expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("carla@x.ph");
      expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("r-cashier");
      expect((systemGroup("POS").getByRole("checkbox", { name: "Sales Processing" }) as HTMLInputElement).checked).toBe(true);
      expect(screen.getByText("Filled in from request RQ-0014")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/admin/account-requests");
    });

    it("lets the Administrator adjust, and says when it differs from the request", async () => {
      const user = userEvent.setup();
      const action = open();
      expect(screen.getByText(/matches the request/)).toBeTruthy();
      await user.click(systemGroup("CREOMS").getByRole("checkbox", { name: "Dashboard" }));
      expect(screen.getByText(/differs from the request/)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /Create user/ }));
      await waitFor(() => expect(action).toHaveBeenCalled());
      expect(action.mock.calls[0][1].getAll("moduleIds")).toEqual(["p-sales", "c-dash"]);
    });
  });
});

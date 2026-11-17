// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/users", () => ({
  deleteUserAction: vi.fn(),
  resendCredentialsAction: vi.fn(),
  restoreUserAction: vi.fn(),
}));
vi.mock("@/lib/admin/users", () => ({
  listUsers: async () => [
    {
      id: "u1",
      username: "2026-ADMIN-001",
      firstName: "Jude",
      lastName: "Nitram",
      email: "jude@example.com",
      roleName: "Admin",
      isAdministrator: true,
      status: "Active",
      mustChangePassword: false,
    },
    {
      id: "u2",
      username: "2026-FM-008",
      firstName: "Fitz",
      lastName: "Martin",
      email: "fitz@example.com",
      roleName: "Staff / Employee",
      isAdministrator: false,
      status: "Active",
      mustChangePassword: false,
    },
  ],
}));

import { UserManagementScreen } from "./user-management-screen";

async function renderScreen(roleName: string, canWrite: boolean) {
  render(await UserManagementScreen({ administratorId: "u1", roleName, canWrite }));
}

describe("User management screen", () => {
  afterEach(cleanup);

  it("gives an Admin the role pill, Add new user and every row control", async () => {
    await renderScreen("Admin", true);

    expect(screen.getByRole("heading", { name: "User management" }).parentElement?.textContent).toContain("Admin");
    expect(screen.getByRole("link", { name: "Add new user" }).getAttribute("href")).toBe("/admin/users/new");
    expect(screen.getAllByRole("link", { name: /manage access/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Delete 2026-FM-008" })).toBeTruthy();
    expect(screen.getByText(/Admins cannot be deleted\./)).toBeTruthy();
    expect(document.body.textContent).not.toContain("Super Admin");
  });

  it("gives a CEO the same screen with every create, edit, delete, restore and resend control absent", async () => {
    await renderScreen("CEO", false);

    expect(screen.getByRole("heading", { name: "User management" }).parentElement?.textContent).toContain("CEO");
    expect(screen.queryByRole("link", { name: "Add new user" })).toBeNull();
    expect(screen.queryByRole("link", { name: /manage access/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /resend|delete|restore/i })).toBeNull();
    // Reading still works: the directory and its filters are there.
    expect(screen.getByText("Fitz Martin")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: /search/i })).toBeTruthy();
  });
});

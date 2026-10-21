// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManagedUser } from "@/lib/admin/user-directory";

import { UserDirectory } from "./user-directory";

const user = (overrides: Partial<ManagedUser> & Pick<ManagedUser, "id" | "username">): ManagedUser => ({
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: `${overrides.username.toLowerCase()}@example.com`,
  roleName: "Staff / Employee",
  isAdministrator: false,
  status: "Active",
  ...overrides,
});

const admin = user({ id: "u1", username: "2026-ADMIN-001", firstName: "Jude", lastName: "Nitram", roleName: "Super Admin", isAdministrator: true });
const ceo = user({ id: "u2", username: "2026-CE-002", firstName: "Cara", lastName: "Eo", roleName: "CEO", isAdministrator: true });
const staff = user({ id: "u3", username: "2026-FM-003", firstName: "Fitz", lastName: "Martin", status: "Awaiting first login" });
const deleted = user({ id: "u4", username: "2026-AB-004", firstName: "Ana", lastName: "Bautista", roleName: "Cashier", status: "Deleted" });

const actions = {
  resend: vi.fn(async () => ({ status: "success" as const, message: "Sent" })),
  remove: vi.fn(async () => ({ error: null })),
  restore: vi.fn(async () => ({ error: null })),
};

function renderDirectory() {
  render(<UserDirectory actions={actions} signedInUserId="u1" users={[admin, ceo, staff, deleted]} />);
}

const rows = () => screen.getAllByRole("row").slice(1);
const row = (username: string) => screen.getByRole("row", { name: new RegExp(username) });

describe("UserDirectory", () => {
  afterEach(cleanup);

  it("summarises the Users and lists each with their Role and status", () => {
    renderDirectory();

    const stats = screen.getByRole("list", { name: "User summary" });
    expect(within(stats).getByText("Total users").nextSibling?.textContent).toBe("4");
    expect(within(stats).getByText("Active").nextSibling?.textContent).toBe("3");
    expect(within(stats).getByText("Super Admins").nextSibling?.textContent).toBe("1");
    expect(within(stats).getByText("Deleted").nextSibling?.textContent).toBe("1");

    expect(within(row("2026-FM-003")).getByText("Fitz Martin")).toBeTruthy();
    expect(within(row("2026-FM-003")).getByText("Awaiting first login")).toBeTruthy();
    expect(within(row("2026-AB-004")).getByText("Cashier")).toBeTruthy();
  });

  it("filters by tab, search and Role, and says so when nothing matches", async () => {
    const events = userEvent.setup();
    renderDirectory();

    await events.click(screen.getByRole("tab", { name: "Deleted 1" }));
    expect(rows()).toHaveLength(1);

    await events.click(screen.getByRole("tab", { name: "Active 3" }));
    await events.type(screen.getByRole("searchbox", { name: /search/i }), "fitz");
    expect(rows().map((entry) => entry.textContent)).toEqual([expect.stringContaining("2026-FM-003")]);

    await events.clear(screen.getByRole("searchbox", { name: /search/i }));
    await events.selectOptions(screen.getByRole("combobox", { name: "Role" }), "CEO");
    expect(rows().map((entry) => entry.textContent)).toEqual([expect.stringContaining("2026-CE-002")]);

    await events.type(screen.getByRole("searchbox", { name: /search/i }), "nobody");
    expect(screen.getByText("No users match these filters.")).toBeTruthy();
  });

  it("offers each User only the actions allowed today", () => {
    renderDirectory();

    expect(within(row("2026-FM-003")).getByRole("link", { name: "Manage access for 2026-FM-003" }).getAttribute("href")).toBe(
      "/admin/users/u3",
    );
    expect(within(row("2026-FM-003")).getByRole("button", { name: /resend credentials/i })).toBeTruthy();
    expect(within(row("2026-FM-003")).getByRole("button", { name: "Delete 2026-FM-003" })).toBeTruthy();
    expect(within(row("2026-CE-002")).getByRole("button", { name: "Delete 2026-CE-002" })).toBeTruthy();

    // Neither the signed-in Administrator nor a Super Admin can be deleted.
    expect(within(row("2026-ADMIN-001")).queryByRole("button", { name: /delete/i })).toBeNull();

    // A Deleted User can only be restored.
    expect(within(row("2026-AB-004")).getByRole("button", { name: "Restore 2026-AB-004" })).toBeTruthy();
    expect(within(row("2026-AB-004")).queryByRole("button", { name: /resend/i })).toBeNull();
  });
});

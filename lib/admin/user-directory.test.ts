import { describe, expect, it } from "vitest";

import { filterUsers, summarizeUsers } from "./user-directory";

const user = (username: string, overrides: Partial<Parameters<typeof filterUsers>[0][number]> = {}) => ({
  id: username,
  username,
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: `${username.toLowerCase()}@example.com`,
  roleName: "Staff / Employee",
  isAdministrator: false,
  status: "Active" as const,
  mustChangePassword: false,
  ...overrides,
});

const users = [
  user("2026-ADMIN-001", { firstName: "Jude", lastName: "Nitram", roleName: "Admin", isAdministrator: true }),
  user("2026-FM-002", { firstName: "Fitz", lastName: "Martin", status: "Awaiting first login" }),
  user("2026-AB-003", { firstName: "Ana", lastName: "Bautista", roleName: "Cashier", status: "Deleted" }),
];

describe("summarizeUsers", () => {
  it("counts every User, those who can log in, live Admins and Deleted Users", () => {
    expect(summarizeUsers(users)).toEqual({ total: 3, active: 2, superAdmins: 1, deleted: 1 });
  });

  it("does not count a Deleted Admin as an Admin", () => {
    const deletedAdmin = user("2026-SA-004", { roleName: "Admin", status: "Deleted" });

    expect(summarizeUsers([deletedAdmin]).superAdmins).toBe(0);
  });
});

describe("filterUsers", () => {
  const all = { tab: "all", query: "", role: "" } as const;
  const usernames = (list: typeof users) => list.map((entry) => entry.username);

  it("shows everyone on the All tab, only Users who can log in on Active, and Deleted Users on Deleted", () => {
    expect(usernames(filterUsers(users, all))).toEqual(["2026-ADMIN-001", "2026-FM-002", "2026-AB-003"]);
    expect(usernames(filterUsers(users, { ...all, tab: "active" }))).toEqual(["2026-ADMIN-001", "2026-FM-002"]);
    expect(usernames(filterUsers(users, { ...all, tab: "deleted" }))).toEqual(["2026-AB-003"]);
  });

  it("searches name, Username and Email, ignoring case and surrounding spaces", () => {
    expect(usernames(filterUsers(users, { ...all, query: "  fitz MARTIN " }))).toEqual(["2026-FM-002"]);
    expect(usernames(filterUsers(users, { ...all, query: "admin-001" }))).toEqual(["2026-ADMIN-001"]);
    expect(usernames(filterUsers(users, { ...all, query: "2026-ab-003@example" }))).toEqual(["2026-AB-003"]);
  });

  it("narrows to one Role, combined with the tab and search", () => {
    expect(usernames(filterUsers(users, { ...all, role: "Cashier" }))).toEqual(["2026-AB-003"]);
    expect(filterUsers(users, { tab: "active", query: "", role: "Cashier" })).toEqual([]);
  });
});

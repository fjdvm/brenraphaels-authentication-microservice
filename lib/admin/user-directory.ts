import { SUPER_ADMIN_ROLE_NAME } from "@/lib/seed-data";

export type UserStatus = "Active" | "Awaiting first login" | "Deleted";

export type ManagedUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  /** Whether the User's Role confers administrative authority (Super Admin or CEO). */
  isAdministrator: boolean;
  status: UserStatus;
};

export type UserSummary = { total: number; active: number; superAdmins: number; deleted: number };

/** Active counts every User who can log in, including those Awaiting first login. */
export type UserTab = "all" | "active" | "deleted";

export type UserFilter = { tab: UserTab; query: string; role: string };

export function summarizeUsers(users: ManagedUser[]): UserSummary {
  const live = users.filter((user) => user.status !== "Deleted");

  return {
    total: users.length,
    active: live.length,
    superAdmins: live.filter((user) => user.roleName === SUPER_ADMIN_ROLE_NAME).length,
    deleted: users.length - live.length,
  };
}

export function filterUsers(users: ManagedUser[], { tab, query, role }: UserFilter): ManagedUser[] {
  const needle = query.trim().toLowerCase();

  return users.filter((user) => {
    if (tab === "active" && user.status === "Deleted") return false;
    if (tab === "deleted" && user.status !== "Deleted") return false;
    if (role && user.roleName !== role) return false;
    if (!needle) return true;

    return [`${user.firstName} ${user.lastName}`, user.username, user.email].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}

"use client";

import { ChevronDown, Key, Search } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { ResendCredentialsButton } from "@/components/admin/resend-credentials-button";
import { UserLifecycleButton } from "@/components/admin/user-lifecycle-button";
import { UserAvatar } from "@/components/layout/user-identity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  filterUsers,
  summarizeUsers,
  type ManagedUser,
  type UserStatus,
  type UserTab,
} from "@/lib/admin/user-directory";
import type { ResendOutcome } from "@/lib/admin/user-form-state";
import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";
import { SUPER_ADMIN_ROLE_NAME } from "@/lib/seed-data";
import { cn } from "@/lib/utils/cn";

type LifecycleAction = (previous: LifecycleFormState, data: FormData) => Promise<LifecycleFormState>;

type Props = {
  users: ManagedUser[];
  /** The signed-in Administrator, who can never delete themselves. */
  signedInUserId: string;
  actions: {
    resend: (userId: string) => Promise<ResendOutcome>;
    remove: LifecycleAction;
    restore: LifecycleAction;
  };
};

const STATUS_BADGE: Record<UserStatus, "success" | "warning" | "danger"> = {
  Active: "success",
  "Awaiting first login": "warning",
  Deleted: "danger",
};

const panel = "rounded-xl border border-panel-border bg-surface";
const field = "flex items-center gap-2 rounded-lg border border-input bg-surface px-3 py-[9px] text-sm leading-[normal]";

/** Figma "Portal · User management": summary, filters and the Users table. */
export function UserDirectory({ users, signedInUserId, actions }: Props) {
  const [tab, setTab] = useState<UserTab>("all");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const searchId = useId();
  const roleId = useId();

  const summary = summarizeUsers(users);
  const shown = filterUsers(users, { tab, query, role });
  const roles = [...new Set(users.map((user) => user.roleName))].sort((a, b) => a.localeCompare(b));

  const stats = [
    { label: "Total users", value: summary.total, hint: "In the portal" },
    { label: "Active", value: summary.active, hint: "Can log in" },
    { label: "Super Admins", value: summary.superAdmins, hint: "Full access to every system" },
    { label: "Deleted", value: summary.deleted, hint: "Can be restored" },
  ];
  const tabs: { value: UserTab; label: string; count: number }[] = [
    { value: "all", label: "All", count: summary.total },
    { value: "active", label: "Active", count: summary.active },
    { value: "deleted", label: "Deleted", count: summary.deleted },
  ];

  return (
    <>
      <ul aria-label="User summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <li className={cn(panel, "flex flex-col gap-1.5 px-5 py-4 leading-[normal]")} key={stat.label}>
            <p className="text-[13px] font-medium text-on-surface-variant">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-on-surface-variant">{stat.hint}</p>
          </li>
        ))}
      </ul>

      <div className="flex min-h-25 flex-wrap items-center gap-3">
        <div aria-label="Filter by status" className="flex gap-1" role="tablist">
          {tabs.map((entry) => (
            <button
              aria-selected={tab === entry.value}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium leading-[normal] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === entry.value ? "bg-identity-soft text-identity" : "text-on-surface-variant hover:text-foreground",
              )}
              key={entry.value}
              onClick={() => setTab(entry.value)}
              role="tab"
              type="button"
            >
              {entry.label} {entry.count}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <label className={cn(field, "w-full focus-within:ring-2 focus-within:ring-ring sm:w-70")} htmlFor={searchId}>
          <Search aria-hidden="true" className="size-4 shrink-0 text-placeholder" />
          <span className="sr-only">Search name, username or email</span>
          <input
            className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-placeholder"
            id={searchId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, username or email"
            type="search"
            value={query}
          />
        </label>
        <div className="relative">
          <label className="sr-only" htmlFor={roleId}>
            Role
          </label>
          <select
            className={cn(field, "field-sizing-content appearance-none pr-9 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring")}
            id={roleId}
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            <option value="">All roles</option>
            {roles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-on-surface-variant" />
        </div>
      </div>

      <div className={cn(panel, "overflow-x-auto px-5 py-1")}>
        <table className="w-full min-w-240 text-left leading-[normal]">
          <thead className="text-xs font-medium text-on-surface-variant">
            <tr className="border-b border-table-divider">
              <th className="w-45 py-3 font-medium" scope="col">Name</th>
              <th className="w-37.5 py-3 font-medium" scope="col">Username</th>
              <th className="w-57.5 py-3 font-medium" scope="col">Email</th>
              <th className="w-35 py-3 font-medium" scope="col">Role</th>
              <th className="w-22.5 py-3 font-medium" scope="col">Status</th>
              <th className="py-3 font-medium" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => {
              const isDeleted = user.status === "Deleted";
              const canDelete = !isDeleted && user.id !== signedInUserId && user.roleName !== SUPER_ADMIN_ROLE_NAME;

              return (
                <tr className="border-b border-table-divider" key={user.id}>
                  <td className="py-3.5 pr-3">
                    <span className="flex items-center gap-2">
                      <UserAvatar size="sm" tone={user.isAdministrator ? "solid" : "soft"} user={user} />
                      <span className="text-sm font-medium whitespace-nowrap text-foreground">
                        {user.firstName} {user.lastName}
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 text-[13px] font-medium whitespace-nowrap text-badge-muted-foreground">
                    {user.username}
                  </td>
                  <td className="py-3.5 pr-3 text-sm whitespace-nowrap text-nav-foreground">{user.email}</td>
                  <td className="py-3.5 pr-3">
                    <Badge className="whitespace-nowrap" variant={user.isAdministrator ? "identity" : "muted"}>
                      {user.roleName}
                    </Badge>
                  </td>
                  <td className="py-3.5 pr-3">
                    <Badge className="whitespace-nowrap" variant={STATUS_BADGE[user.status]}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-start justify-end gap-2">
                      <Button asChild size="row" variant="row-action">
                        <Link aria-label={`Manage access for ${user.username}`} href={`/admin/users/${user.id}`}>
                          <Key aria-hidden="true" />
                          Access
                        </Link>
                      </Button>
                      {isDeleted ? (
                        <UserLifecycleButton action={actions.restore} mode="restore" userId={user.id} username={user.username} />
                      ) : (
                        <ResendCredentialsButton action={() => actions.resend(user.id)} username={user.username} />
                      )}
                      {canDelete ? (
                        <UserLifecycleButton action={actions.remove} mode="delete" userId={user.id} username={user.username} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 ? (
              <tr>
                <td className="py-10 text-center text-sm text-on-surface-variant" colSpan={6}>
                  No users match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdministrator } from "@/lib/auth/session";
import { listUsers, type UserStatus } from "@/lib/admin/users";

const statusVariant: Record<UserStatus, "default" | "secondary" | "destructive"> = {
  Active: "default",
  "Awaiting first login": "secondary",
  Deleted: "destructive",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await connection();
  await requireAdministrator();
  const [users, { created }] = await Promise.all([listUsers(), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">User management</h1>
          <Button asChild>
            <Link href="/admin/users/new">
              <UserPlus aria-hidden="true" />
              Add new user
            </Link>
          </Button>
        </div>

        {created && /^\d{4}-[A-Z]{2}-\d{3,}$/.test(created) ? (
          <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary" role="status">
            User {created} was created. Their Username and Temporary password have been emailed to them.
          </p>
        ) : null}

        <section aria-labelledby="users-heading" className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <h2 id="users-heading" className="text-lg font-semibold text-primary">
              Users
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              All Users in the portal, including Deleted Users.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-220 text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3 font-medium" scope="col">Username</th>
                  <th className="px-6 py-3 font-medium" scope="col">Name</th>
                  <th className="px-6 py-3 font-medium" scope="col">Email</th>
                  <th className="px-6 py-3 font-medium" scope="col">Role</th>
                  <th className="px-6 py-3 font-medium" scope="col">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className={user.status === "Deleted" ? "bg-destructive/5" : undefined}>
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-medium text-primary">
                      {user.username}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-foreground">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-on-surface-variant">{user.roleName}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={statusVariant[user.status]}>{user.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </main>
  );
}

import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { ManagedUser, UserStatus } from "./user-directory";

export type { ManagedUser, UserStatus };

function getUserStatus(user: {
  isDeleted: boolean;
  mustChangePassword: boolean;
}): UserStatus {
  if (user.isDeleted) {
    return "Deleted";
  }

  return user.mustChangePassword ? "Awaiting first login" : "Active";
}

/** Returns every User retained by the portal, including Deleted Users. */
export async function listUsers(): Promise<ManagedUser[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      isDeleted: true,
      mustChangePassword: true,
      role: { select: { name: true, isAdministrator: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { username: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    roleName: user.role.name,
    isAdministrator: user.role.isAdministrator,
    status: getUserStatus(user),
  }));
}

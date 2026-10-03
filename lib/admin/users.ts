import "server-only";

import { prisma } from "@/lib/db/prisma";

export type UserStatus = "Active" | "Awaiting first login" | "Deleted";

export type ManagedUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  status: UserStatus;
};

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
      role: { select: { name: true } },
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
    status: getUserStatus(user),
  }));
}

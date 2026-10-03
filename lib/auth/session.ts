import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";

import { auth } from "./server";

export type PortalUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
};

/**
 * The signed-in User, read from our database on every call (deduplicated per
 * request). The Neon Auth session only proves who someone is; whether they may
 * proceed, and whether they are a Super Admin, is always decided here, so a Deleted
 * or demoted User loses access immediately (ADR-0001, ADR-0002).
 */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { neonAuthUserId: session.user.id },
    include: { role: { select: { isSuperAdmin: true } } },
  });

  if (!user || user.isDeleted) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    isSuperAdmin: user.role.isSuperAdmin,
  };
});

/**
 * Guard for every protected page and Server Action. Pages must call this
 * themselves: layouts don't re-render on client navigation, and the proxy only
 * checks that a session cookie exists.
 */
export async function requirePortalUser(
  options: { allowMustChangePassword?: boolean } = {},
): Promise<PortalUser> {
  const user = await getPortalUser();

  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword && !options.allowMustChangePassword) {
    redirect("/change-password");
  }

  return user;
}

/**
 * Guard for the one-time password-change route and its Server Action. An active
 * User cannot be sent back through this flow once their temporary password has
 * been replaced.
 */
export async function requirePasswordChangeUser(): Promise<PortalUser> {
  const user = await requirePortalUser({ allowMustChangePassword: true });

  if (!user.mustChangePassword) {
    redirect("/");
  }

  return user;
}

export async function requireSuperAdmin(): Promise<PortalUser> {
  const user = await requirePortalUser();

  if (!user.isSuperAdmin) {
    redirect("/");
  }

  return user;
}

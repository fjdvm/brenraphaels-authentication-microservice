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
  isAdministrator: boolean;
  roleName: string;
};

/**
 * The signed-in User, read from our database on every call (deduplicated per
 * request). The Neon Auth session only proves who someone is; whether they may
 * proceed, and whether they are an Administrator, is always decided here, so a Deleted
 * or demoted User loses access immediately. A Role confers administrative
 * authority only when its current isAdministrator flag is set.
 */
export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { neonAuthUserId: session.user.id },
    include: { role: { select: { isAdministrator: true, name: true } } },
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
    isAdministrator: user.role.isAdministrator,
    roleName: user.role.name,
  };
});

/** Only what the shell shows of the signed-in User, for passing to client components. */
export function toShellUser({ firstName, lastName, username, email, roleName }: PortalUser) {
  return { firstName, lastName, username, email, roleName };
}

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

export async function requireAdministrator(): Promise<PortalUser> {
  const user = await requirePortalUser({ allowMustChangePassword: true });

  if (!user.isAdministrator) {
    redirect("/");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return user;
}

export type FreshCentralSession =
  | { status: "signed_out" }
  | { status: "ineligible" }
  | { status: "must_change_password" }
  | { status: "ok"; userId: string; neonSessionId: string };

/**
 * The browser's central session, validated against Neon Auth with the SDK's local
 * session cache bypassed. The default getSession() may answer from a signed
 * session_data cookie for minutes after the session was revoked; the handoff must
 * not issue a code on that basis.
 */
export async function getFreshCentralSession(): Promise<FreshCentralSession> {
  const { data: session } = await auth.getSession({ query: { disableCookieCache: "true" } });

  if (!session?.user || !session.session) {
    return { status: "signed_out" };
  }

  const user = await prisma.user.findUnique({
    where: { neonAuthUserId: session.user.id },
    select: { id: true, isDeleted: true, mustChangePassword: true },
  });

  if (!user || user.isDeleted) {
    return { status: "ineligible" };
  }

  if (user.mustChangePassword) {
    return { status: "must_change_password" };
  }

  return { status: "ok", userId: user.id, neonSessionId: session.session.id };
}

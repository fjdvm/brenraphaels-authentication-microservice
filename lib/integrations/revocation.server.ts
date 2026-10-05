import "server-only";

import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";

/** The id of the browser's current central session, read uncached; null when there is none. */
export async function currentCentralSessionId(): Promise<string | null> {
  try {
    const { data } = await auth.getSession({ query: { disableCookieCache: "true" } });

    return data?.session?.id ?? null;
  } catch (error) {
    console.error("Failed to read the central session id:", error instanceof Error ? error.name : "unknown");

    return null;
  }
}

/**
 * Marks every integration handle bound to a central session as revoked. Live
 * validation already denies them once the central session is gone; this is the
 * explicit record. Never throws, so it cannot block a logout.
 */
export async function revokeIntegrationHandles(neonSessionId: string | null): Promise<void> {
  if (!neonSessionId) {
    return;
  }

  try {
    await prisma.integrationSession.updateMany({
      where: { neonSessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to revoke integration handles:", error instanceof Error ? error.name : "unknown");
  }
}

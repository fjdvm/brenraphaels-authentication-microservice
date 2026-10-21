import "server-only";

import { isIP } from "node:net";

import { headers } from "next/headers";

import { getPortalUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

import {
  createAuditClient,
  readSystemLogs,
  type AuditLogEntry,
  type RequestContext,
  type UserDirectory,
} from "./audit-logs";
import type { AuditEventInput } from "./events";

const users: UserDirectory = async (ids) => {
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, firstName: true, lastName: true },
  });

  return new Map(rows.map((u) => [u.id, `${u.firstName} ${u.lastName} (${u.username})`]));
};

/**
 * The Portal's connection to the audit-logs service: the Source "Authentication" write
 * key and a read key, both server-side only. If they are not configured every call fails,
 * writes are dropped (best effort) and the System logs page shows its error state.
 */
const client = createAuditClient({
  baseUrl: process.env.AUDIT_LOGS_URL ?? "",
  writeKey: process.env.AUDIT_LOGS_WRITE_KEY ?? "",
  readKey: process.env.AUDIT_LOGS_READ_KEY ?? "",
  users,
});

async function requestContext(): Promise<RequestContext> {
  try {
    const incoming = await headers();
    const forwarded = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();

    return {
      ipAddress: forwarded && isIP(forwarded) ? forwarded : null,
      userAgent: incoming.get("user-agent"),
      requestId: incoming.get("x-vercel-id") ?? incoming.get("x-request-id"),
    };
  } catch {
    // Outside a request (scripts, tests) there is no context to attach.
    return {};
  }
}

/** The audit-writing port. Never throws and never blocks a flow beyond a short timeout and one retry. */
export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  await client.record(event, await requestContext());
}

export async function listSystemLogEvents(): Promise<AuditLogEntry[]> {
  return readSystemLogs(client, await getPortalUser());
}

import "server-only";

import { isIP } from "node:net";

import { headers } from "next/headers";

import { getPortalUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

import {
  auditGatewayConfig,
  createAuditClient,
  readMyLogs,
  exportSystemLogs,
  readSystemLogOptions,
  readSystemLogs,
  type AuditExport,
  type AuditExportFilters,
  type AuditFilterOptions,
  type AuditLogFilters,
  type AuditLogPage,
  type RequestContext,
  type UserDirectory,
  userDisplayName,
} from "./audit-logs";
import type { AuditEventInput } from "./events";

const users: UserDirectory = async (ids) => {
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, firstName: true, lastName: true },
  });

  return new Map(rows.map((u) => [u.id, userDisplayName(u)]));
};

/**
 * The Portal's connection to the audit-logs service, through the api-gateway like every
 * other shared service. Both Caller keys stay on the server. If they are not configured
 * every call fails, writes are dropped (best effort) and the System logs page shows its
 * error state. The read key also serves the Staff home's previous sign-in, always narrowed
 * to the signed-in User on the server.
 */
const client = createAuditClient({
  ...auditGatewayConfig({
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
    API_GATEWAY_KEY: process.env.API_GATEWAY_KEY,
    API_GATEWAY_AUDIT_READ_KEY: process.env.API_GATEWAY_AUDIT_READ_KEY,
  }),
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

export async function listSystemLogEvents(filters: AuditLogFilters): Promise<AuditLogPage> {
  return readSystemLogs(client, await getPortalUser(), filters);
}

export async function listSystemLogOptions(): Promise<AuditFilterOptions> {
  return readSystemLogOptions(client, await getPortalUser());
}

/** My Logs: the signed-in User's own events. The Actor is the session's User, never a request value. */
export async function listMyLogEvents(filters: AuditLogFilters): Promise<AuditLogPage> {
  return readMyLogs(client, await getPortalUser(), filters);
}


export async function exportSystemLogEvents(filters: AuditExportFilters): Promise<AuditExport> {
  return exportSystemLogs(client, await getPortalUser(), filters);
}

/** The signed-in User's "Last sign-in"; null (a dash) when there is none or the service can't be read. */
export async function readPreviousSignIn(): Promise<Date | null> {
  const user = await getPortalUser();

  return user ? client.previousSignIn(user.id) : null;
}

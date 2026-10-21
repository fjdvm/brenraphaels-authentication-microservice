import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { getFreshCentralSession } from "@/lib/auth/session";
import { handleAuthorize } from "@/lib/integrations/endpoints";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";

export async function GET(request: Request): Promise<Response> {
  return handleAuthorize(request, {
    ports: prismaHandoffPorts,
    audit: recordAuditEvent,
    resolveSubject: getFreshCentralSession,
  });
}

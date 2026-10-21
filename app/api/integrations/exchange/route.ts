import { recordAuditEvent } from "@/lib/audit/audit-logs.server";
import { handleExchange } from "@/lib/integrations/endpoints";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";

export async function POST(request: Request): Promise<Response> {
  return handleExchange(request, {
    ports: prismaHandoffPorts,
    audit: recordAuditEvent,
  });
}

import { recordSystemLogEvent } from "@/lib/audit/system-log";
import { handleExchange } from "@/lib/integrations/endpoints";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";

export async function POST(request: Request): Promise<Response> {
  return handleExchange(request, {
    ports: prismaHandoffPorts,
    audit: recordSystemLogEvent,
  });
}

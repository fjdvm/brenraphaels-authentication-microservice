import { handleSystems } from "@/lib/integrations/endpoints";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";

export async function POST(request: Request): Promise<Response> {
  return handleSystems(request, { ports: prismaHandoffPorts });
}

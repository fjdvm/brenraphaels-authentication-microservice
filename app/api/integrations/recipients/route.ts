import { prisma } from "@/lib/db/prisma";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";
import { handleRecipients } from "@/lib/integrations/recipients";

export async function POST(request: Request): Promise<Response> {
  return handleRecipients(request, {
    findSystemByName: prismaHandoffPorts.findSystemByName,
    async listEligibleStaff(systemId) {
      const users = await prisma.user.findMany({
        where: { isDeleted: false, mustChangePassword: false, accessGrants: { some: { revokedAt: null, module: { systemId, retiredAt: null } } } },
        select: { id: true, username: true, firstName: true, lastName: true, role: { select: { name: true } }, accessGrants: { where: { revokedAt: null, module: { systemId, retiredAt: null } }, select: { module: { select: { name: true } } } } },
      });
      return users.map(user => ({ id: user.id, username: user.username, name: `${user.firstName} ${user.lastName}`, role: user.role.name, modules: [...new Set(user.accessGrants.map(grant => grant.module.name))] }));
    },
  });
}

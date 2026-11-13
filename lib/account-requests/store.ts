import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AccountRequestPorts, RequestReceipt } from "./endpoints";

type Database = { query<T>(sql: Prisma.Sql): Promise<T[]> };

/** Parameterized SQL is shared by the real Portal database and in-memory Postgres tests. */
export function createAccountRequestStore(db: Database): Omit<AccountRequestPorts, "notify"> {
  const findRequest: AccountRequestPorts["findRequest"] = async (systemId, reference) => {
    const rows = await db.query<RequestReceipt>(Prisma.sql`
      SELECT reference, status FROM "AccountRequest" WHERE "sourceSystemId" = ${systemId} AND reference = ${reference}`);
    return rows[0] ?? null;
  };
  return {
    findRequest,
    async findSystemByName(name) {
      const rows = await db.query<{ id: string; backendSecretHash: string | null }>(Prisma.sql`
        SELECT id, "backendSecretHash" FROM "System" WHERE name = ${name}`);
      return rows[0] ?? null;
    },
    async options() {
      const roles = await db.query<{ id: string; name: string }>(Prisma.sql`SELECT id, name FROM "Role" ORDER BY name, id`);
      const systems = await db.query<{ id: string; name: string }>(Prisma.sql`SELECT id, name FROM "System" ORDER BY name, id`);
      const modules = await db.query<{ id: string; name: string; systemId: string }>(Prisma.sql`
        SELECT id, name, "systemId" FROM "Module" WHERE "retiredAt" IS NULL ORDER BY name, id`);
      const templates = await db.query<{ roleId: string; moduleId: string }>(Prisma.sql`
        SELECT t."roleId", t."moduleId" FROM "AccessTemplate" t JOIN "Module" m ON m.id = t."moduleId"
        WHERE m."retiredAt" IS NULL ORDER BY t."moduleId"`);
      return {
        roles: roles.map(role => ({ ...role, moduleIds: templates.filter(t => t.roleId === role.id).map(t => t.moduleId) })),
        systems: systems.map(system => ({ ...system, modules: modules.filter(m => m.systemId === system.id).map(({ id, name }) => ({ id, name })) })),
      };
    },
    async receive(systemId, input) {
      const { employee } = input;
      // ON CONFLICT handles both concurrent reference redelivery and competing
      // active requests for one email. Existing Users include Deleted Users.
      const rows = await db.query<RequestReceipt>(Prisma.sql`
        INSERT INTO "AccountRequest" (id, reference, "sourceSystemId", "personName", "workEmail", "personalEmail", mobile,
          position, branch, "startDate", "roleId", "moduleIds", "neededFrom", note, "requesterName", "updatedAt")
        SELECT ${randomUUID()}, ${input.reference}, ${systemId}, ${employee.name}, ${employee.workEmail}, ${employee.personalEmail}, ${employee.mobile},
          ${employee.position}, ${employee.branch}, ${employee.startDate}::date, ${input.roleId},
          ${input.moduleIds.length ? Prisma.sql`ARRAY[${Prisma.join(input.moduleIds)}]::text[]` : Prisma.sql`ARRAY[]::text[]`},
          ${input.neededFrom}::date, ${input.note}, ${input.requestedBy.name}, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE lower(email) = ${employee.workEmail})
        ON CONFLICT DO NOTHING RETURNING reference, status`);
      if (rows[0]) return { kind: "created", request: rows[0] };
      const existing = await findRequest(systemId, input.reference);
      return existing ? { kind: "duplicate", request: existing } : { kind: "email-taken" };
    },
    async administratorIds() {
      const users = await db.query<{ id: string }>(Prisma.sql`
        SELECT u.id FROM "User" u JOIN "Role" r ON r.id = u."roleId"
        WHERE NOT u."isDeleted" AND r."isAdministrator" ORDER BY u.id`);
      return users.map(user => user.id);
    },
  };
}

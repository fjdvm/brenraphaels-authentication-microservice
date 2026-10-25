/** Run after `npm run build`, with SEED_TEST_DATABASE_URL pointing to a disposable
 * Neon branch. Starts the compiled Next app against that branch, never the local
 * .env database. The fixtures and central-session rows are removed afterwards.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

import { hashToken } from "../lib/integrations/tokens";

async function main() {
  const databaseUrl = process.env.SEED_TEST_DATABASE_URL;
  assert(databaseUrl, "Set SEED_TEST_DATABASE_URL to a disposable Neon branch first");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
  const suffix = randomUUID();
  const identityId = randomUUID();
  const centralSessionId = randomUUID();
  const roleId = `cache-role-${suffix}`;
  const userId = `cache-user-${suffix}`;
  const systemId = `cache-system-${suffix}`;
  const secret = randomUUID();
  const handle = randomUUID();
  const expiresAt = new Date(Date.now() + 600_000);
  const email = `cache-${suffix}@example.test`;

  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      // Do not send audit events from these fixtures to production shared services.
      API_GATEWAY_URL: "",
      API_GATEWAY_KEY: "",
      API_GATEWAY_AUDIT_READ_KEY: "",
    },
    stdio: "ignore",
  });

  try {
    const healthUrl = `http://127.0.0.1:${port}/api/integrations/validate`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert(server.exitCode === null, "Next production server exited before becoming ready");
      try {
        await fetch(healthUrl, { method: "POST", body: "{}" });
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert(ready, "Next production server did not become ready");

    await prisma.$executeRaw`INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
      VALUES (${identityId}::uuid, 'Cache regression', ${email}, true)`;
    await prisma.$executeRaw`INSERT INTO neon_auth.session (id, token, "userId", "expiresAt", "updatedAt")
      VALUES (${centralSessionId}::uuid, ${randomUUID()}, ${identityId}::uuid, ${expiresAt}, now())`;
    await prisma.role.create({ data: { id: roleId, name: roleId } });
    await prisma.user.create({ data: {
      id: userId, username: userId, email, firstName: "Cache", lastName: "Regression",
      roleId, neonAuthUserId: identityId, mustChangePassword: false,
    } });
    await prisma.system.create({ data: {
      id: systemId, name: systemId, url: "https://cache.example.test", backendSecretHash: hashToken(secret),
    } });
    const sales = await prisma.module.create({ data: { systemId, name: "Sales" } });
    const stock = await prisma.module.create({ data: { systemId, name: "Stock" } });
    const grant = await prisma.accessGrant.create({ data: { userId, moduleId: sales.id } });
    await prisma.accessGrant.create({ data: { userId, moduleId: stock.id } });
    await prisma.integrationSession.create({ data: {
      userId, systemId, neonSessionId: centralSessionId, handleHash: hashToken(handle), expiresAt,
    } });

    async function validate(module = "Sales") {
      const response = await fetch(healthUrl, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${systemId}:${secret}`).toString("base64")}` },
        body: JSON.stringify({ handle, module }),
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      return { status: response.status, body: await response.json() };
    }

    assert.equal((await validate()).status, 200);
    assert.equal((await validate()).status, 200);
    // No tag invalidation: security must see direct database revocation even while
    // the same compiled server and handle remain warm.
    await prisma.accessGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    assert.deepEqual(await validate(), { status: 403, body: { error: "access_denied" } });
    assert.equal((await validate("Stock")).status, 200);
    await prisma.$executeRaw`DELETE FROM neon_auth.session WHERE id = ${centralSessionId}::uuid`;
    assert.deepEqual(await validate("Stock"), { status: 401, body: { error: "invalid_handle" } });
    console.log("PASS compiled Next: warm Module 200 → revoked 403; retained Module 200 → revoked session 401; all no-store");
  } finally {
    server.kill("SIGTERM");
    await prisma.integrationSession.deleteMany({ where: { userId } });
    await prisma.accessGrant.deleteMany({ where: { userId } });
    await prisma.module.deleteMany({ where: { systemId } });
    await prisma.system.deleteMany({ where: { id: systemId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.$executeRaw`DELETE FROM neon_auth.session WHERE id = ${centralSessionId}::uuid`;
    await prisma.$executeRaw`DELETE FROM neon_auth."user" WHERE id = ${identityId}::uuid`;
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

import { buildSystemRegistration } from "../lib/integrations/registration";

config({ path: ".env.local" });
config({ path: ".env.credentials" });

// Usage: npm run system:register -- <SYSTEM> <callback-url> [<callback-url> ...]
// Replaces the System's approved callbacks and rotates its backend secret.
async function main() {
  const [systemName, ...callbacks] = process.argv.slice(2);

  if (!systemName || callbacks.length === 0) {
    throw new Error("Usage: npm run system:register -- <SYSTEM> <callback-url> [<callback-url> ...]");
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set.");
  }

  const { registration, secret } = buildSystemRegistration(callbacks);
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  try {
    const result = await prisma.system.updateMany({
      where: { name: systemName.toUpperCase() },
      data: registration,
    });

    if (result.count !== 1) {
      throw new Error(`No System named "${systemName}". Seed the Systems first.`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Registered ${systemName.toUpperCase()} with ${registration.callbackUrls.length} callback(s):`);
  registration.callbackUrls.forEach((url) => console.log(`  ${url}`));
  console.log("\nBackend secret (shown once, store it in the System backend's secret store):");
  console.log(`  ${secret}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

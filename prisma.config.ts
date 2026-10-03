import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js loads .env.local itself; Prisma CLI commands and the seed script don't.
config({ path: ".env.local" });
config({ path: ".env.credentials" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Prisma CLI (migrate, db seed) uses the direct, non-pooled connection. Left out
  // when unset so `prisma generate` works in builds that have no database access.
  ...(process.env.DIRECT_URL
    ? { datasource: { url: process.env.DIRECT_URL } }
    : {}),
});

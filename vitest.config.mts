import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Transform the SDK so Vite resolves its extensionless Next.js imports.
    server: { deps: { inline: ["@neondatabase/auth"] } },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});

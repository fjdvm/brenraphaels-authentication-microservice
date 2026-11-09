import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
    // Transform the SDK so Vite resolves its extensionless Next.js imports.
    server: { deps: { inline: ["@neondatabase/auth"] } },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});

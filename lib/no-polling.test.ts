import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// ADR-0005: no app polls. A repeating timer or focus-triggered refetch in shipped source is a regression.
const root = path.resolve(import.meta.dirname, "..");
const roots = ["app", "components", "hooks", "lib", "actions"];
const forbidden = /setInterval|refetchInterval|refetchOnWindowFocus|revalidateOnFocus/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sources(file);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|browser\.test)\.tsx?$/.test(name) ? [file] : [];
  });
}

describe("no polling (ADR-0005)", () => {
  it("ships no repeating data timer or focus refetch", () => {
    const hits = roots
      .flatMap((r) => sources(path.join(root, r)))
      .filter((file) => forbidden.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(root, file));
    expect(hits).toEqual([]);
  });
});

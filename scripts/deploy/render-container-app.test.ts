import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const script = path.join(repoRoot, "scripts/deploy/render-container-app.py");

const certificateId =
  "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/cae/managedCertificates/mc-portal";

function secretsFromExample() {
  const example = readFileSync(path.join(repoRoot, ".env.production.example"), "utf8");
  const keys = [...example.matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1]);
  return Object.fromEntries([...keys, "GHCR_PULL_TOKEN"].map((key) => [key, "value"]));
}

describe("render-container-app.py", () => {
  let dir: string;
  let output: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "render-portal-"));
    output = path.join(dir, "manifest.json");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function render(overrides: Record<string, string | undefined> = {}) {
    const env: Record<string, string | undefined> = {
      PATH: process.env.PATH,
      DEPLOY_SECRETS: JSON.stringify(secretsFromExample()),
      CONTAINER_ENVIRONMENT_ID: "/subscriptions/sub/environments/cae",
      GHCR_USERNAME: "fjdvm",
      REVISION_SUFFIX: "gh-1-1",
      PORTAL_IMAGE: "ghcr.io/fjdvm/portal@sha256:abc",
      PORTAL_PUBLIC_URL: "https://portal.buildwrite.me",
      PORTAL_CUSTOM_DOMAIN: "portal.buildwrite.me",
      PORTAL_CERTIFICATE_ID: certificateId,
      ...overrides,
    };
    return spawnSync("python3", ["-I", script, output], {
      cwd: repoRoot,
      env: env as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
  }

  it("keeps the custom domain bound with its managed certificate", () => {
    const result = render();

    expect(result.status).toBe(0);
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.properties.configuration.ingress.customDomains).toEqual([
      { name: "portal.buildwrite.me", bindingType: "SniEnabled", certificateId },
    ]);
  });

  it.each([undefined, ""])(
    "refuses to render without a certificate id (%j) instead of dropping the binding",
    (value) => {
      const result = render({ PORTAL_CERTIFICATE_ID: value });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("PORTAL_CERTIFICATE_ID");
      expect(existsSync(output)).toBe(false);
    },
  );
});

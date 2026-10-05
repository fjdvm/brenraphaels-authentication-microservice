import { createHash, randomBytes } from "node:crypto";

import {
  type AuthorizeSubject,
  type EndpointDeps,
} from "./endpoints";
import {
  type HandoffCodeRecord,
  type HandoffPorts,
  type IntegrationSessionRecord,
  type RegisteredSystem,
} from "./handoff";
import { buildSystemRegistration } from "./registration";

export const CALLBACK = "https://crms.example.com/auth/callback";
export const STATE = "correlation-state-0123456789";

export type World = {
  now: Date;
  systems: RegisteredSystem[];
  eligible: Set<string>;
  grants: Set<string>; // `${userId}:${systemId}`
  liveSessions: Set<string>;
  codes: (HandoffCodeRecord & { consumed: boolean })[];
  sessions: IntegrationSessionRecord[];
  audit: unknown[];
  subject: AuthorizeSubject;
};

export function createWorld(): { world: World; deps: EndpointDeps; secrets: Record<string, string> } {
  const secrets: Record<string, string> = {};
  const systems: RegisteredSystem[] = ["CRMS", "POS"].map((name) => {
    const { registration, secret } = buildSystemRegistration([
      name === "CRMS" ? CALLBACK : "https://pos.example.com/cb",
    ]);
    secrets[name] = secret;

    return { id: `sys-${name}`, name, ...registration };
  });

  const world: World = {
    now: new Date("2026-10-07T10:00:00Z"),
    systems,
    eligible: new Set(["user-1"]),
    grants: new Set(["user-1:sys-CRMS"]),
    liveSessions: new Set(["neon-session-1"]),
    codes: [],
    sessions: [],
    audit: [],
    subject: { status: "ok", userId: "user-1", neonSessionId: "neon-session-1" },
  };

  const ports: HandoffPorts = {
    async findSystemByName(name) {
      return world.systems.find((system) => system.name === name) ?? null;
    },
    async isUserEligible(userId) {
      return world.eligible.has(userId);
    },
    async hasActiveGrantInSystem(userId, systemId) {
      return world.grants.has(`${userId}:${systemId}`);
    },
    async isCentralSessionActive(id) {
      return world.liveSessions.has(id);
    },
    async saveCode(record) {
      world.codes.push({ ...record, consumed: false });
    },
    async consumeCode(codeHash, systemId, now) {
      // Check-and-set with no await in between mirrors the database's conditional UPDATE.
      const code = world.codes.find(
        (candidate) =>
          candidate.codeHash === codeHash &&
          candidate.systemId === systemId &&
          !candidate.consumed &&
          candidate.expiresAt > now,
      );

      if (!code) {
        return null;
      }

      code.consumed = true;

      return code;
    },
    async saveSession(record) {
      world.sessions.push(record);
    },
    now: () => world.now,
  };

  const deps: EndpointDeps = {
    ports,
    audit: async (event) => {
      world.audit.push(event);
    },
    resolveSubject: async () => world.subject,
  };

  return { world, deps, secrets };
}

// --- A simulated System backend: what a consumer is expected to do. -------------------
export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");

  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizeUrl(overrides: Record<string, string | null> = {}, challenge = "") {
  const params: Record<string, string | null> = {
    system: "CRMS",
    redirect_uri: CALLBACK,
    state: STATE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...overrides,
  };
  const url = new URL("https://portal.example.com/api/integrations/authorize");

  for (const [key, value] of Object.entries(params)) {
    if (value !== null) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

import "server-only";

import { prisma } from "@/lib/db/prisma";

import {
  generateToken,
  hashSecret,
  pkceChallenge,
  secretMatchesHash,
} from "./secrets";

export const CODE_TTL_MS = 60_000;
export const SESSION_TTL_MS = 12 * 60 * 60_000;

export type AuthorizeRequest = {
  system: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
};

export function parseAuthorizeRequest(url: URL): AuthorizeRequest | null {
  const system = url.searchParams.get("system");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const method = url.searchParams.get("code_challenge_method");

  if (!system || !redirectUri || !state || !codeChallenge || method !== "S256") {
    return null;
  }

  return { system, redirectUri, state, codeChallenge };
}

/** The registered System for an exact registered callback, or null. */
export async function findRegisteredCallback(system: string, redirectUri: string) {
  const callback = await prisma.systemCallback.findFirst({
    where: {
      url: redirectUri,
      system: { name: system },
      ...(process.env.NODE_ENV === "production" ? { nonProductionOnly: false } : {}),
    },
    select: { url: true, system: { select: { id: true, name: true } } },
  });

  return callback ? { callbackUrl: callback.url, system: callback.system } : null;
}

/** Whether the User is active and holds at least one active Module grant in the System. */
export async function mayEnterSystem(userId: string, systemId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true },
  });

  if (!user || user.isDeleted) {
    return false;
  }

  const grants = await prisma.accessGrant.count({
    where: { userId, revokedAt: null, module: { systemId } },
  });

  return grants > 0;
}

export async function issueCode(input: {
  systemId: string;
  userId: string;
  callbackUrl: string;
  centralSessionId: string;
  correlation: string;
  codeChallenge: string;
}): Promise<string> {
  const code = generateToken();

  await prisma.handoffCode.create({
    data: {
      codeHash: hashSecret(code),
      systemId: input.systemId,
      userId: input.userId,
      callbackUrl: input.callbackUrl,
      centralSessionId: input.centralSessionId,
      correlation: input.correlation,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  return code;
}

/** The System whose backend presented a valid secret, or null. */
export async function authenticateSystem(system: string, secret: string) {
  const record = await prisma.system.findUnique({
    where: { name: system },
    select: { id: true, name: true, secretHash: true },
  });

  if (!record?.secretHash || !secretMatchesHash(secret, record.secretHash)) {
    return null;
  }

  return { id: record.id, name: record.name };
}

export type ExchangeInput = {
  systemId: string;
  code: string;
  redirectUri: string;
  correlation: string;
  codeVerifier: string;
};

export type ExchangeResult =
  | { ok: true; sessionHandle: string; expiresAt: Date }
  | { ok: false };

/**
 * Trades a code for a System-bound session handle. The code is consumed atomically
 * before its bindings are checked, so a wrong-proof attempt cannot be retried and a
 * concurrent replay can never win twice. A code issued to another System is left
 * untouched so one System cannot burn another's codes.
 */
export async function exchangeCode(input: ExchangeInput): Promise<ExchangeResult> {
  const codeHash = hashSecret(input.code);
  const stored = await prisma.handoffCode.findUnique({ where: { codeHash } });

  if (!stored || stored.systemId !== input.systemId) {
    return { ok: false };
  }

  const consumed = await prisma.handoffCode.updateMany({
    where: { id: stored.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });

  if (consumed.count !== 1) {
    return { ok: false };
  }

  if (
    stored.callbackUrl !== input.redirectUri ||
    stored.correlation !== input.correlation ||
    stored.codeChallenge !== pkceChallenge(input.codeVerifier)
  ) {
    return { ok: false };
  }

  if (!(await mayEnterSystem(stored.userId, stored.systemId))) {
    return { ok: false };
  }

  const sessionHandle = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.systemSession.create({
    data: {
      handleHash: hashSecret(sessionHandle),
      systemId: stored.systemId,
      userId: stored.userId,
      centralSessionId: stored.centralSessionId,
      expiresAt,
    },
  });

  return { ok: true, sessionHandle, expiresAt };
}

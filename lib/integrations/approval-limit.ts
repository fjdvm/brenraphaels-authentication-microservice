import { getFreshCentralSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken } from "@/lib/integrations/tokens";

/** Reads, or with `amountInCentavos` changes, the Approval limit. CREOMS owns and audits it under this live identity. */
export async function callApprovalLimit(userId: string, body: { amountInCentavos?: number }): Promise<{ status: number; body: Record<string, unknown> }> {
  return callCreoms(userId, "/api/approvals/limit", body);
}

/** Reads, or with both hours changes, the Service levels. CREOMS owns and audits them under this live identity. */
export async function callServiceLevels(userId: string, body: { firstReplyHours?: number; resolveHours?: number }): Promise<{ status: number; body: Record<string, unknown> }> {
  return callCreoms(userId, "/api/service-levels", body);
}

async function callCreoms(userId: string, path: string, body: object): Promise<{ status: number; body: Record<string, unknown> }> {
  const central = await getFreshCentralSession();
  if (central.status !== "ok" || central.userId !== userId) return { status: 401, body: { error: "Sign in again." } };
  const system = await prisma.system.findUniqueOrThrow({ where: { name: "CRMS" } });
  const url = new URL(path, system.url);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) throw new Error("Untrusted CREOMS URL");
  const handle = generateToken();
  const session = await prisma.integrationSession.create({ data: { handleHash: hashToken(handle), systemId: system.id,
    userId, neonSessionId: central.neonSessionId, expiresAt: new Date(Date.now() + 60_000) } });
  try {
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${handle}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) });
    return { status: response.status, body: await response.json() };
  } finally {
    await prisma.integrationSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  }
}

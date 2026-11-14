import { getFreshCentralSession, getPortalUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken } from "@/lib/integrations/tokens";

/** Backend for Portal Settings. CREOMS owns and audits the setting under this live identity. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  if (!["Super Admin", "Admin", "CEO", "CRMS Manager", "CREOMS Manager", "Manager"].includes(user.roleName)) {
    return Response.json({ error: "Your Role cannot open these Settings." }, { status: 403, headers });
  }
  try {
    const input = await request.json();
    const changing = Object.hasOwn(input, "amountInCentavos");
    if (changing && !["Super Admin", "Admin"].includes(user.roleName)) return Response.json({ error: "Only an Admin can change the Approval limit." }, { status: 403, headers });
    if (changing && (!Number.isSafeInteger(input.amountInCentavos) || input.amountInCentavos < 0)) return Response.json({ error: "Enter a nonnegative whole number of centavos." }, { status: 400, headers });
    const central = await getFreshCentralSession();
    if (central.status !== "ok" || central.userId !== user.id) return Response.json({ error: "Sign in again." }, { status: 401, headers });
    const system = await prisma.system.findUniqueOrThrow({ where: { name: "CRMS" } });
    const url = new URL("/api/approvals/limit", system.url);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) throw new Error("Untrusted CREOMS URL");
    const handle = generateToken();
    const session = await prisma.integrationSession.create({ data: { handleHash: hashToken(handle), systemId: system.id,
      userId: user.id, neonSessionId: central.neonSessionId, expiresAt: new Date(Date.now() + 60_000) } });
    try {
      const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${handle}`, "Content-Type": "application/json" },
        body: JSON.stringify(changing ? { amountInCentavos: input.amountInCentavos } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) });
      return Response.json(await response.json(), { status: response.status, headers });
    } finally {
      await prisma.integrationSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    }
  } catch { return Response.json({ error: "Approval settings are temporarily unavailable." }, { status: 503, headers }); }
}

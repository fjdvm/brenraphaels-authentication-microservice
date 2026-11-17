import { canReadShopSettings, canWrite } from "@/lib/auth/role-authority";
import { getPortalUser } from "@/lib/auth/session";
import { callApprovalLimit } from "@/lib/integrations/approval-limit";

/** Backend for Portal Settings. CREOMS owns and audits the setting under this live identity. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  if (!canReadShopSettings(user.roleName)) {
    return Response.json({ error: "Your Role cannot open these Settings." }, { status: 403, headers });
  }
  try {
    const input = await request.json();
    const changing = Object.hasOwn(input, "amountInCentavos");
    if (changing && !canWrite(user.roleName)) return Response.json({ error: "Only an Admin can change the Approval limit." }, { status: 403, headers });
    if (changing && (!Number.isSafeInteger(input.amountInCentavos) || input.amountInCentavos < 0)) return Response.json({ error: "Enter a nonnegative whole number of centavos." }, { status: 400, headers });
    const result = await callApprovalLimit(user.id, changing ? { amountInCentavos: input.amountInCentavos } : {});
    return Response.json(result.body, { status: result.status, headers });
  } catch { return Response.json({ error: "Approval settings are temporarily unavailable." }, { status: 503, headers }); }
}

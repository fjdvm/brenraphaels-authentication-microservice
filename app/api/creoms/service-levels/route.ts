import { canReadShopSettings, canWrite } from "@/lib/auth/role-authority";
import { getPortalUser } from "@/lib/auth/session";
import { callServiceLevels } from "@/lib/integrations/approval-limit";

const whole = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 1 && (n as number) <= 8760;

/** Backend for Portal Settings, Service levels. CREOMS owns and audits the setting under this live identity. */
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
    const changing = Object.hasOwn(input, "firstReplyHours") || Object.hasOwn(input, "resolveHours");
    if (changing && !canWrite(user.roleName)) return Response.json({ error: "Only an Admin can change the Service levels." }, { status: 403, headers });
    if (changing && (!whole(input.firstReplyHours) || !whole(input.resolveHours))) return Response.json({ error: "Enter whole hours from 1 to 8760." }, { status: 400, headers });
    const result = await callServiceLevels(user.id, changing ? { firstReplyHours: input.firstReplyHours, resolveHours: input.resolveHours } : {});
    return Response.json(result.body, { status: result.status, headers });
  } catch { return Response.json({ error: "Service levels are temporarily unavailable." }, { status: 503, headers }); }
}

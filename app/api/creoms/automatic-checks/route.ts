import { canReadShopSettings, canWrite } from "@/lib/auth/role-authority";
import { getPortalUser } from "@/lib/auth/session";
import { callAutomaticChecks } from "@/lib/integrations/approval-limit";

const headers = { "Cache-Control": "no-store" };

/** Backend for Portal Settings, Automatic checks. Admin and CEO read; only an Admin saves. CREOMS owns and audits the settings. */
async function authorise(request: Request, write: boolean) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { error: Response.json({ error: "Invalid request origin." }, { status: 403, headers }) };
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return { error: Response.json({ error: "Sign in first." }, { status: 401, headers }) };
  if (!canReadShopSettings(user.roleName)) return { error: Response.json({ error: "Your Role cannot open these Settings." }, { status: 403, headers }) };
  if (write && !canWrite(user.roleName)) return { error: Response.json({ error: "Only an Admin can change the Automatic checks." }, { status: 403, headers }) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await authorise(request, false);
  if (auth.error) return auth.error;
  try {
    const result = await callAutomaticChecks(auth.user.id);
    return Response.json(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: "Automatic checks are temporarily unavailable." }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const auth = await authorise(request, true);
  if (auth.error) return auth.error;
  try {
    const checks = await request.json();
    if (!checks || typeof checks !== "object" || Array.isArray(checks)) return Response.json({ error: "Send the Automatic checks to save." }, { status: 400, headers });
    const result = await callAutomaticChecks(auth.user.id, checks);
    return Response.json(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: "Automatic checks are temporarily unavailable." }, { status: 503, headers });
  }
}

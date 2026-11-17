import { canReadShopSettings } from "@/lib/auth/role-authority";
import { getPortalUser } from "@/lib/auth/session";
import { savePaymentSettings } from "@/lib/settings/payment-settings";
import { paymentSettingsPorts, readPaymentSettings } from "@/lib/settings/payment-settings.server";

const headers = { "Cache-Control": "no-store" };

/** General settings, payment details. Admin edits; CEO and Managers view; everyone else is refused. */
export async function GET() {
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  if (!canReadShopSettings(user.roleName)) return Response.json({ error: "Your Role cannot open these Settings." }, { status: 403, headers });
  return Response.json({ settings: await readPaymentSettings() }, { headers });
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  try {
    const result = await savePaymentSettings(paymentSettingsPorts, { id: user.id, roleName: user.roleName }, await request.json());
    return result.ok ? Response.json({ ok: true, settings: result.settings }, { headers }) : Response.json({ error: result.error }, { status: result.status, headers });
  } catch {
    return Response.json({ error: "The payment details could not be saved. Nothing was changed." }, { status: 503, headers });
  }
}

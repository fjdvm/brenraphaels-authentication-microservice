import { canReadShopSettings } from "@/lib/auth/role-authority";
import { getPortalUser } from "@/lib/auth/session";
import { addPaymentAccount } from "@/lib/settings/payment-accounts";
import { paymentAccountPorts, readPaymentAccounts, signQr } from "@/lib/settings/payment-accounts.server";

const headers = { "Cache-Control": "no-store" };

/** Settings, Payments tab. Admin changes; CEO and Managers view; everyone else is refused. */
export async function GET() {
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  if (!canReadShopSettings(user.roleName)) return Response.json({ error: "Your Role cannot open these Settings." }, { status: 403, headers });
  return Response.json({ accounts: await signQr(await readPaymentAccounts()) }, { headers });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  try {
    const result = await addPaymentAccount(paymentAccountPorts, { id: user.id, roleName: user.roleName }, await request.json());
    return result.ok ? Response.json({ ok: true, account: (await signQr([result.account]))[0] }, { status: 201, headers }) : Response.json({ error: result.error }, { status: result.status, headers });
  } catch {
    return Response.json({ error: "The account could not be added. Nothing was changed." }, { status: 503, headers });
  }
}

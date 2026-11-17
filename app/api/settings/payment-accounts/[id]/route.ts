import { getPortalUser } from "@/lib/auth/session";
import { editPaymentAccount, setPaymentAccountActive } from "@/lib/settings/payment-accounts";
import { paymentAccountPorts, signQr } from "@/lib/settings/payment-accounts.server";

const headers = { "Cache-Control": "no-store" };

/** Edit an account's name and number (`{ method, accountName, accountNumber, bankName }`) or deactivate or reactivate it (`{ active }`). No DELETE exists. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const actor = { id: user.id, roleName: user.roleName };
    if (typeof body === "object" && body !== null && "active" in body && "accountName" in body) return Response.json({ error: "Send either an edit or an active change, not both." }, { status: 400, headers });
    const isActiveChange = typeof body === "object" && body !== null && typeof (body as { active?: unknown }).active === "boolean" && !("accountName" in body);
    const result = isActiveChange
      ? await setPaymentAccountActive(paymentAccountPorts, actor, id, (body as { active: boolean }).active)
      : await editPaymentAccount(paymentAccountPorts, actor, id, body);
    return result.ok ? Response.json({ ok: true, account: (await signQr([result.account]))[0] }, { headers }) : Response.json({ error: result.error }, { status: result.status, headers });
  } catch {
    return Response.json({ error: "The account could not be changed. Nothing was changed." }, { status: 503, headers });
  }
}

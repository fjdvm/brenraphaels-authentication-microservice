import { parseBasicCredentials } from "@/lib/integrations/basic";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";
import { hashToken, safeEqual } from "@/lib/integrations/tokens";
import { firstActiveByMethod } from "@/lib/settings/payment-accounts";
import { readActivePaymentAccounts, signQr } from "@/lib/settings/payment-accounts.server";

/** Backend-only: the Ecommerce System reads the active Payment accounts for checkout with its System secret. Inactive accounts never leave the Portal. */
export async function GET(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const credentials = parseBasicCredentials(request.headers.get("authorization"));
    const system = credentials ? await prismaHandoffPorts.findSystemByName(credentials.name) : null;
    if (!credentials || credentials.name !== "Ecommerce" || !system?.backendSecretHash || !safeEqual(hashToken(credentials.secret), system.backendSecretHash)) {
      return Response.json({ error: "invalid_client" }, { status: 401, headers });
    }
    const stored = await readActivePaymentAccounts();
    const accounts = await signQr(stored);
    return Response.json({ accounts, settings: firstActiveByMethod(stored) }, { headers });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
  }
}

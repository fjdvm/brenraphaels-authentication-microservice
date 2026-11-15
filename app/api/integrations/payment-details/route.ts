import { parseBasicCredentials } from "@/lib/integrations/basic";
import { prismaHandoffPorts } from "@/lib/integrations/prisma-ports.server";
import { hashToken, safeEqual } from "@/lib/integrations/tokens";
import { readPaymentSettings } from "@/lib/settings/payment-settings.server";

/** Backend-only: the Ecommerce System reads the shop's payment details for checkout with its System secret. */
export async function GET(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const credentials = parseBasicCredentials(request.headers.get("authorization"));
    const system = credentials ? await prismaHandoffPorts.findSystemByName(credentials.name) : null;
    if (!credentials || credentials.name !== "Ecommerce" || !system?.backendSecretHash || !safeEqual(hashToken(credentials.secret), system.backendSecretHash)) {
      return Response.json({ error: "invalid_client" }, { status: 401, headers });
    }
    return Response.json({ settings: await readPaymentSettings() }, { headers });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
  }
}

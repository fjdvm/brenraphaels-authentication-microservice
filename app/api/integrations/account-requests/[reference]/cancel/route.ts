import { handleAccountRequestAction } from "@/lib/account-requests/endpoints";
import { accountRequestPorts } from "@/lib/account-requests/ports.server";

export async function POST(request: Request, context: { params: Promise<{ reference: string }> }): Promise<Response> {
  const { reference } = await context.params;
  return handleAccountRequestAction(request, reference, "cancel", accountRequestPorts);
}

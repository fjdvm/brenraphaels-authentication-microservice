import { handleAccountRequestOptions } from "@/lib/account-requests/endpoints";
import { accountRequestPorts } from "@/lib/account-requests/ports.server";

export async function GET(request: Request): Promise<Response> {
  return handleAccountRequestOptions(request, accountRequestPorts);
}

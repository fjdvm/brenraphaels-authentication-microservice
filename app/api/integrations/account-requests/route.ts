import { handleAccountRequest } from "@/lib/account-requests/endpoints";
import { accountRequestPorts } from "@/lib/account-requests/ports.server";

export async function POST(request: Request): Promise<Response> {
  return handleAccountRequest(request, accountRequestPorts);
}

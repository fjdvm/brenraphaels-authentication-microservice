import { parseBasicCredentials } from "./basic";
import { hashToken, safeEqual } from "./tokens";

type Ports = {
  findSystemByName(name: string): Promise<{ id: string; backendSecretHash: string | null } | null>;
  listEligibleStaff(systemId: string): Promise<{ id: string; username: string; modules: string[] }[]>;
};

/** Backend-only directory. A System may enumerate grants only in its own System. */
export async function handleRecipients(request: Request, ports: Ports): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const credentials = parseBasicCredentials(request.headers.get("authorization"));
    const system = credentials ? await ports.findSystemByName(credentials.name) : null;
    if (!credentials || !system?.backendSecretHash || !safeEqual(hashToken(credentials.secret), system.backendSecretHash)) {
      return Response.json({ error: "invalid_client" }, { status: 401, headers });
    }
    return Response.json({ staff: await ports.listEligibleStaff(system.id) }, { headers });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
  }
}

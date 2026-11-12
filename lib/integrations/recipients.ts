import { hasLegacyHiringAccess, LEGACY_HRMS_HIRING } from "./hrms-legacy-hiring";
import { parseBasicCredentials } from "./basic";
import { hashToken, safeEqual } from "./tokens";

type Ports = {
  findSystemByName(name: string): Promise<{ id: string; backendSecretHash: string | null } | null>;
  listEligibleStaff(systemId: string): Promise<{ id: string; username: string; name: string; modules: string[] }[]>;
};

/** Backend-only directory. A System may enumerate grants only in its own System. Each Staff member carries a display `name`; HRMS needs it for its Interviewer picker (fjdvm/hrms#268). */
export async function handleRecipients(request: Request, ports: Ports): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    const credentials = parseBasicCredentials(request.headers.get("authorization"));
    const system = credentials ? await ports.findSystemByName(credentials.name) : null;
    if (!credentials || !system?.backendSecretHash || !safeEqual(hashToken(credentials.secret), system.backendSecretHash)) {
      return Response.json({ error: "invalid_client" }, { status: 401, headers });
    }
    const staff = await ports.listEligibleStaff(system.id);
    return Response.json({ staff: credentials.name === "HRMS"
      ? staff.map((user) => ({ ...user, modules: hasLegacyHiringAccess(user.modules)
        ? [...user.modules, LEGACY_HRMS_HIRING] : user.modules }))
      : staff }, { headers });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
  }
}

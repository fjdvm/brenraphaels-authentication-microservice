import { authenticateSystem, exchangeCode } from "@/lib/integrations/handoff";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function failure(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/** HTTP Basic: `SYSTEM:secret`, as presented by the System's backend. */
function systemCredentials(request: Request): { system: string; secret: string } | null {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const separator = decoded.indexOf(":");

  if (separator <= 0) {
    return null;
  }

  return { system: decoded.slice(0, separator), secret: decoded.slice(separator + 1) };
}

/** Server-to-server code exchange; never called from a browser. */
export async function POST(request: Request): Promise<Response> {
  const credentials = systemCredentials(request);
  const system = credentials
    ? await authenticateSystem(credentials.system, credentials.secret)
    : null;

  if (!system) {
    return failure("invalid_client", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  const field = (name: string): string | null => {
    const value = (body as Record<string, unknown> | null)?.[name];
    return typeof value === "string" && value ? value : null;
  };

  const code = field("code");
  const redirectUri = field("redirect_uri");
  const correlation = field("state");
  const codeVerifier = field("code_verifier");

  if (!code || !redirectUri || !correlation || !codeVerifier) {
    return failure("invalid_request", 400);
  }

  const result = await exchangeCode({
    systemId: system.id,
    code,
    redirectUri,
    correlation,
    codeVerifier,
  });

  if (!result.ok) {
    return failure("invalid_grant", 400);
  }

  return Response.json(
    {
      session_handle: result.sessionHandle,
      expires_at: result.expiresAt.toISOString(),
    },
    { headers: NO_STORE },
  );
}

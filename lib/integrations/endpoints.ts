import {
  authorizeHandoff,
  exchangeCode,
  handoffFailure,
  type HandoffErrorCode,
  type HandoffPorts,
} from "./handoff";
import {
  validateAccess,
  validationFailure,
  type ValidationErrorCode,
  type ValidationPorts,
} from "./validation";

export type AuthorizeSubject =
  | { status: "signed_out" }
  | { status: "must_change_password" }
  | { status: "ineligible" }
  | { status: "ok"; userId: string; neonSessionId: string };

export type EndpointAudit = (event: {
  action: "integration.authorize" | "integration.exchange" | "integration.validate";
  outcome: "SUCCESS" | "FAILURE";
  actorId?: string | null;
  targetUserId?: string | null;
  detail: string;
}) => Promise<void>;

export type EndpointDeps = {
  ports: HandoffPorts;
  audit: EndpointAudit;
  /** Freshly validated (uncached) browser session for the authorize request. */
  resolveSubject(): Promise<AuthorizeSubject>;
};

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function errorResponse(error: HandoffErrorCode | ValidationErrorCode, status: number, extra: HeadersInit = {}): Response {
  return Response.json({ error }, { status, headers: { ...NO_STORE, ...extra } });
}

/**
 * GET /api/integrations/authorize — browser entry point. Redirects back to the
 * registered callback with a single-use code, or answers with a JSON error. It never
 * redirects to an unregistered callback, not even to report an error.
 */
export async function handleAuthorize(request: Request, deps: EndpointDeps): Promise<Response> {
  try {
    return await authorize(request, deps);
  } catch (error) {
    // Name only: provider errors can carry connection details.
    console.error("Integration authorize unavailable:", error instanceof Error ? error.name : "unknown");

    return errorResponse("temporarily_unavailable", 503, { "Retry-After": "5" });
  }
}

async function authorize(request: Request, deps: EndpointDeps): Promise<Response> {
  const subject = await deps.resolveSubject();

  if (subject.status === "signed_out") {
    return Response.redirect(new URL("/login", request.url), 302);
  }

  if (subject.status === "must_change_password") {
    return Response.redirect(new URL("/change-password", request.url), 302);
  }

  if (subject.status === "ineligible") {
    return errorResponse("access_denied", 403);
  }

  const params = new URL(request.url).searchParams;
  const result = await authorizeHandoff(deps.ports, {
    system: params.get("system"),
    redirectUri: params.get("redirect_uri"),
    state: params.get("state"),
    codeChallenge: params.get("code_challenge"),
    codeChallengeMethod: params.get("code_challenge_method"),
    subject: { userId: subject.userId, neonSessionId: subject.neonSessionId },
  });

  const systemName = result.system?.name ?? "unregistered System";

  if (!result.ok) {
    await deps.audit({
      action: "integration.authorize",
      outcome: "FAILURE",
      actorId: subject.userId,
      targetUserId: subject.userId,
      detail: `${systemName}: ${result.error}`,
    });

    return errorResponse(result.error, result.status);
  }

  await deps.audit({
    action: "integration.authorize",
    outcome: "SUCCESS",
    actorId: subject.userId,
    targetUserId: subject.userId,
    detail: `${systemName}: code issued`,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: result.redirectTo, ...NO_STORE },
  });
}

function parseBasicCredentials(header: string | null): { name: string; secret: string } | null {
  const match = header?.match(/^Basic\s+(\S+)$/i);

  if (!match) {
    return null;
  }

  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");

  if (separator < 1) {
    return null;
  }

  return { name: decoded.slice(0, separator), secret: decoded.slice(separator + 1) };
}

function stringField(body: unknown, key: string): string | null {
  const value = (body as Record<string, unknown> | null)?.[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * POST /api/integrations/exchange — server-to-server. The System backend
 * authenticates with HTTP Basic (System name : backend secret) and trades the code,
 * PKCE verifier, callback and state for an opaque integration handle.
 */
export async function handleExchange(
  request: Request,
  deps: Pick<EndpointDeps, "ports" | "audit">,
): Promise<Response> {
  const credentials = parseBasicCredentials(request.headers.get("authorization"));

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  let result;
  try {
    result = await exchangeCode(deps.ports, {
      systemName: credentials?.name ?? null,
      secret: credentials?.secret ?? null,
      code: stringField(body, "code"),
      codeVerifier: stringField(body, "code_verifier"),
      redirectUri: stringField(body, "redirect_uri"),
      state: stringField(body, "state"),
    });
  } catch (error) {
    console.error("Integration exchange unavailable:", error instanceof Error ? error.name : "unknown");
    const unavailable = handoffFailure("temporarily_unavailable");

    return errorResponse(unavailable.error, unavailable.status, { "Retry-After": "5" });
  }

  const systemName = result.system?.name ?? "unknown System";

  if (!result.ok) {
    // Authentication failures have no identified System to attribute; keep them out of the log's noise but still visible.
    await deps.audit({
      action: "integration.exchange",
      outcome: "FAILURE",
      detail: `${systemName}: ${result.error}`,
    });

    return errorResponse(
      result.error,
      result.status,
      result.error === "invalid_client" ? { "WWW-Authenticate": 'Basic realm="integrations"' } : {},
    );
  }

  await deps.audit({
    action: "integration.exchange",
    outcome: "SUCCESS",
    actorId: null,
    targetUserId: result.userId,
    detail: `${systemName}: handle issued`,
  });

  return Response.json(
    { handle: result.handle, token_type: "opaque", expires_in: result.expiresIn },
    { headers: NO_STORE },
  );
}

/**
 * POST /api/integrations/validate — server-to-server, called by a System backend
 * before every protected request. Basic backend credentials plus `{ handle, module }`.
 * `200 { active: true }` is the only positive decision; every other status denies.
 * 401 `invalid_handle` / 403 `access_denied` mean invalid access; 503
 * `temporarily_unavailable` means validation could not run. All of them deny.
 */
export async function handleValidate(
  request: Request,
  deps: { ports: ValidationPorts; audit: EndpointAudit },
): Promise<Response> {
  const credentials = parseBasicCredentials(request.headers.get("authorization"));

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  let result;
  try {
    result = await validateAccess(deps.ports, {
      systemName: credentials?.name ?? null,
      secret: credentials?.secret ?? null,
      handle: stringField(body, "handle"),
      moduleName: stringField(body, "module"),
    });
  } catch (error) {
    console.error("Integration validation unavailable:", error instanceof Error ? error.name : "unknown");
    const unavailable = validationFailure("temporarily_unavailable");

    return errorResponse(unavailable.error, unavailable.status, { "Retry-After": "5" });
  }

  if (!result.ok) {
    // Only an identified User losing access is worth an audit row; invalid handles and
    // bad credentials are routine noise on a per-request endpoint.
    if (result.error === "access_denied") {
      await deps.audit({
        action: "integration.validate",
        outcome: "FAILURE",
        actorId: null,
        targetUserId: result.userId ?? null,
        detail: `${result.system?.name ?? "unknown System"}: access denied`,
      });
    }

    return errorResponse(
      result.error,
      result.status,
      result.error === "invalid_client" ? { "WWW-Authenticate": 'Basic realm="integrations"' } : {},
    );
  }

  return Response.json(
    { active: true, user_id: result.userId, system: result.system, module: result.module },
    { headers: NO_STORE },
  );
}

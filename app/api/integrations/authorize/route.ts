import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import {
  findRegisteredCallback,
  issueCode,
  mayEnterSystem,
  parseAuthorizeRequest,
} from "@/lib/integrations/handoff";

export const dynamic = "force-dynamic";

function redirectTo(location: URL | string, requestUrl: URL): Response {
  return Response.redirect(new URL(location, requestUrl), 302);
}

function invalidRequest(): Response {
  return Response.json({ error: "invalid_request" }, { status: 400 });
}

/**
 * Browser entry point of the sign-in handoff. Parameters and callback are validated
 * before anything else, and an unregistered callback is never redirected to.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = parseAuthorizeRequest(url);

  if (!params) {
    return invalidRequest();
  }

  const registered = await findRegisteredCallback(params.system, params.redirectUri);

  if (!registered) {
    return invalidRequest();
  }

  const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);

  // The cookie cache could still vouch for a session that has since been revoked.
  const { data: session } = await auth.getSession({
    query: { disableCookieCache: "true" },
  });

  if (!session?.user) {
    return redirectTo(`/login?returnTo=${returnTo}`, url);
  }

  const user = await prisma.user.findUnique({
    where: { neonAuthUserId: session.user.id },
    select: { id: true, isDeleted: true, mustChangePassword: true },
  });

  const refused = new URL(registered.callbackUrl);
  refused.searchParams.set("error", "access_denied");
  refused.searchParams.set("state", params.state);

  if (!user || user.isDeleted) {
    return redirectTo(refused, url);
  }

  if (user.mustChangePassword) {
    return redirectTo(`/change-password?returnTo=${returnTo}`, url);
  }

  if (!(await mayEnterSystem(user.id, registered.system.id))) {
    return redirectTo(refused, url);
  }

  const code = await issueCode({
    systemId: registered.system.id,
    userId: user.id,
    callbackUrl: registered.callbackUrl,
    centralSessionId: session.session.id,
    correlation: params.state,
    codeChallenge: params.codeChallenge,
  });

  const granted = new URL(registered.callbackUrl);
  granted.searchParams.set("code", code);
  granted.searchParams.set("state", params.state);

  return redirectTo(granted, url);
}

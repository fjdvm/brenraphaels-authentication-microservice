import { createServer } from "node:http";

import { createSystemConsumer, type DenialReason } from "./consumer";

// A runnable stand-in for a System backend. Not a real System: it holds no data and
// serves no business pages. Configure with environment variables (never commit secrets):
//
//   SIM_SYSTEM_NAME     registered System name              (default CRMS)
//   SIM_BACKEND_SECRET  secret from `npm run system:register`  (required)
//   SIM_PORTAL_URL      portal origin                        (default http://localhost:3000)
//   SIM_PORT            port to listen on                    (default 4000)
//   SIM_MODULE          a Module of that System to protect   (default Dashboard)
const systemName = process.env.SIM_SYSTEM_NAME ?? "CRMS";
const backendSecret = process.env.SIM_BACKEND_SECRET;
const portalUrl = process.env.SIM_PORTAL_URL ?? "http://localhost:3000";
const port = Number(process.env.SIM_PORT ?? 4000);
const defaultModule = process.env.SIM_MODULE ?? "Dashboard";

if (!backendSecret) {
  console.error("SIM_BACKEND_SECRET is required. Register the System first: npm run system:register -- <SYSTEM> <callback>");
  process.exit(1);
}

const callbackUrl = `http://localhost:${port}/auth/callback`;
const consumer = createSystemConsumer({ portalUrl, systemName, backendSecret, callbackUrl });
const COOKIE = "sim_session";

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:34rem;margin:3rem auto;line-height:1.5"><h1>${title}</h1>${body}</body>`;

function readCookie(header: string | undefined): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === COOKIE)?.[1];
}

const DENIALS: Record<DenialReason, { status: number; title: string; body: string }> = {
  sign_in_required: { status: 302, title: "", body: "" },
  no_access: {
    status: 403,
    title: "No access",
    body: "You are signed in, but you can't use this Module. Ask an Administrator. Signing in again will not help.",
  },
  unavailable: {
    status: 503,
    title: "Temporarily unavailable",
    body: "The portal can't confirm your access right now, so this request was blocked. Please try again in a moment.",
  },
  misconfigured: {
    status: 500,
    title: "Integration misconfigured",
    body: "This System's portal credentials were rejected. An operator must fix the configuration.",
  },
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const html = (status: number, title: string, body: string, headers: Record<string, string> = {}) => {
    response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
    response.end(page(title, body));
  };
  const redirect = (location: string, headers: Record<string, string> = {}) => {
    response.writeHead(302, { Location: location, ...headers });
    response.end();
  };

  if (url.pathname === "/") {
    return html(200, `Simulated ${systemName}`, `<p><a href="/modules/${encodeURIComponent(defaultModule)}">Open ${defaultModule}</a></p>`);
  }

  if (url.pathname === "/login") {
    return redirect(consumer.startSignIn().authorizeUrl);
  }

  if (url.pathname === "/auth/callback") {
    const result = await consumer.completeSignIn(`http://localhost:${port}${request.url}`);

    if (result.ok) {
      return redirect(`/modules/${encodeURIComponent(defaultModule)}`, {
        "Set-Cookie": `${COOKIE}=${result.sessionId}; HttpOnly; SameSite=Lax; Path=/`,
      });
    }

    const reason = result.reason === "invalid_callback" || result.reason === "invalid_grant" ? "sign_in_required" : result.reason;
    const denial = DENIALS[reason];

    return reason === "sign_in_required"
      ? html(400, "Sign-in expired", `<p>That sign-in can't be used. <a href="/login">Start again</a>.</p>`)
      : html(denial.status, denial.title, `<p>${denial.body}</p>`, result.retryable ? { "Retry-After": "5" } : {});
  }

  const moduleMatch = url.pathname.match(/^\/modules\/(.+)$/);

  if (moduleMatch) {
    const moduleName = decodeURIComponent(moduleMatch[1]);
    const decision = await consumer.authenticate(readCookie(request.headers.cookie), moduleName);

    if (decision.allow) {
      return html(200, moduleName, `<p>Signed in as ${decision.userId}. This request was validated centrally just now.</p>`);
    }

    // Direct entry: no usable session sends the browser to the portal, which shows
    // login if needed and returns here once authorized.
    if (decision.reason === "sign_in_required") {
      return redirect("/login");
    }

    const denial = DENIALS[decision.reason];

    return html(denial.status, denial.title, `<p>${denial.body}</p>`, decision.retryable ? { "Retry-After": "5" } : {});
  }

  html(404, "Not found", "");
}).listen(port, () => {
  console.log(`Simulated ${systemName} on http://localhost:${port} (portal ${portalUrl})`);
  console.log(`Register this callback first: ${callbackUrl}`);
});

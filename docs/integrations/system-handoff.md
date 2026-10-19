# System sign-in handoff

How a registered System lets a User who is already signed in to the portal enter it, without the System ever seeing the User's password or the portal's session cookies.

**Status.** This is the portal side of the contract only, exercised by a simulated System backend in `lib/integrations/handoff.test.ts`. It is **not** a complete OIDC provider, and **no real System (CRMS, HRMS, POS, IMS) is integrated yet**. Seeded System URLs, including the placeholders, are never trusted as callbacks. Per-request live validation and logout revocation are documented below. For a walkthrough and a runnable reference consumer see [system-integration-guide.md](./system-integration-guide.md); for what is verified and what is outstanding see [verification.md](./verification.md).

## Registering a System

Nothing is trusted until an operator registers it explicitly:

```bash
npm run system:register -- CRMS https://crms.example.com/auth/callback [more callbacks...]
```

- Replaces the System's approved callback list and **rotates** its backend secret.
- Callbacks must be absolute `https` URLs (`http` only for `localhost`/`127.0.0.1`), with no credentials or fragment.
- The backend secret (`iss_…`) is printed once. Put it in the System backend's secret store. Only its SHA-256 hash is stored, and it must never be committed or logged.
- A System with no registered secret, or a callback that is not an exact string match, is refused.

## 1. Authorize (browser)

`GET /api/integrations/authorize` — the System sends the User's browser here.

| Query parameter | Notes |
| --- | --- |
| `system` | Registered System name, e.g. `CRMS`. |
| `redirect_uri` | Must exactly equal a registered callback. |
| `state` | Request correlation, 16–256 printable ASCII characters. Echoed back and re-checked at exchange. |
| `code_challenge` | PKCE: `BASE64URL(SHA256(code_verifier))`, 43 characters. |
| `code_challenge_method` | Must be `S256`. |

The portal validates the browser's central session **uncached** against Neon Auth, then checks that the User is not Deleted, is not awaiting their first password change, and holds at least one active Module AccessGrant in that System.

- Success: `302` to `redirect_uri?code=…&state=…`. The code is single-use and valid for **60 seconds**. Only its hash is stored, bound to the System, exact callback, state, PKCE challenge and the original central session.
- No session: `302` to `/login?ri=…`. Awaiting first login: `302` to `/change-password?ri=…`. The request is validated first (see below), so an invalid one is refused instead of being sent through login.
- Failures are never a redirect to an unregistered callback: `400 invalid_request` (unknown System, unregistered callback, missing/invalid parameters), `403 access_denied` (ineligible or no grant in that System). They are JSON, except that a browser navigation (`Accept: text/html`) gets a readable HTML page with the same status.

### Direct entry through central login

A User who opens a System directly has no portal session, so the System redirects them to authorize and the portal takes them through login:

1. Authorize validates the request exactly as above (registered System, exact callback, `state`, PKCE) and only then redirects to `/login?ri=<token>`. `ri` is an HMAC-signed (`NEON_AUTH_COOKIE_SECRET`) copy of the validated request, valid for **15 minutes**.
2. The login page and form carry `ri` in a hidden field. After a successful login the browser goes to `/api/integrations/authorize?…` rebuilt from the verified token, or first to `/change-password?ri=…` for a User awaiting first login, and to the same authorize path after the password is changed.
3. Authorize runs again as an ordinary request, re-checking the central session, that the User is not Deleted or still awaiting a password change, and that they still hold a Module grant in the System, before any code is issued. A User who lost access meanwhile gets the denial, never a code.

`ri` can never choose a destination: the only place it can send the browser is the portal's own authorize path, and a tampered, foreign-signed, malformed or expired token is ignored. Login and password change then behave as ordinary portal use, the pages say the System request expired or is invalid, and the System restarts its request by redirecting to authorize again (or the User opens it from the portal). Completing **Forgot password** does not resume a System request; the System starts a fresh one.

`/api/integrations/authorize` is excluded from the `proxy.ts` session redirect so that a signed-out request reaches this logic instead of being sent to a bare `/login`.

## 2. Exchange (System backend → portal)

`POST /api/integrations/exchange` — server to server. No browser cookies are sent or accepted.

```
Authorization: Basic base64("<SYSTEM>:<backend secret>")
Content-Type: application/json

{ "code": "…", "code_verifier": "…", "redirect_uri": "…", "state": "…" }
```

Success `200`:

```json
{ "handle": "ish_…", "token_type": "opaque", "expires_in": 28800 }
```

The handle is opaque, bound to the System and to the original central session, and stored hashed. Treat it as a secret. `expires_in` is the handle's maximum lifetime; whether it may be used is decided by live validation (section 3), not by this value.

The code is consumed atomically on the first attempt that presents a valid backend credential for the right System. After that it is dead whatever the outcome, so a failed or tampered attempt cannot be retried with corrected parameters.

| Status | `error` | Meaning |
| --- | --- | --- |
| 401 | `invalid_client` | Missing or wrong backend credentials. Does not consume any code. |
| 400 | `invalid_request` | Missing field. |
| 400 | `invalid_grant` | Unknown, expired, replayed or other-System code; callback, state or PKCE verifier mismatch; the central session has ended. |
| 403 | `access_denied` | The User was Deleted or lost every Module grant in the System since authorization. |
| 503 | `temporarily_unavailable` | The portal could not decide. No handle is issued; retry later. |

Responses carry `Cache-Control: no-store`. Codes, handles and secrets are never written to System Logs or other diagnostics; the log records only that an authorization or exchange succeeded or failed, and why in coarse terms.

## 3. Validate (System backend → portal, every protected request)

`POST /api/integrations/validate` — server to server, same Basic backend credentials as the exchange. Call it **before every protected request**, with the handle and the Module being requested.

```
Authorization: Basic base64("<SYSTEM>:<backend secret>")
Content-Type: application/json

{ "handle": "ish_…", "module": "Customer Profiles" }
```

`module` is the Module's name within the calling System. Success `200` is the only positive decision:

```json
{
  "active": true,
  "user_id": "…",
  "system": "CRMS",
  "module": "Customer Profiles",
  "staff": { "name": "Ada Okafor", "username": "ada.okafor", "email": "ada@example.com", "role": "Customer Support" }
}
```

`staff` is the User's current display details, so a System can show who is signed in. The Role is for display only; it never decides access.

Anything else is a denial. Do not serve the request, and do not cache a `200` for later requests: the next request must validate again.

| Status | `error` | Meaning | What the System should do |
| --- | --- | --- | --- |
| 401 | `invalid_client` | Missing or wrong backend credentials. | Fix configuration; deny. |
| 400 | `invalid_request` | `handle` or `module` missing, or unreadable body. | Fix the call; deny. |
| 401 | `invalid_handle` | Handle unknown, expired, revoked, issued to a different System, or its central session has ended (logout, expiry). | Discard the handle; send the User through the sign-in handoff again. |
| 403 | `access_denied` | The User is Deleted or missing, is awaiting a mandatory password change, or holds no active AccessGrant on that Module of this System. | Deny; show a no-access page. Signing in again will not help until an Administrator changes the User's access. |
| 503 | `temporarily_unavailable` | The session provider, database or portal could not decide. Carries `Retry-After: 5`. | **Deny** and retry later. Never allow on an outage. |

`invalid_handle`, `access_denied` and `temporarily_unavailable` all deny; they differ only in what the User or operator should do next. Responses carry `Cache-Control: no-store`.

What is checked, every call and in this order: the System's credentials; the handle's System binding, expiry and revocation mark; the **original central session** read live from the session provider's own store (never the SDK's local session cache, a signed identity token, or a login-time permission snapshot); the User's current status; and the User's current AccessGrant on that exact Module. A revoked Module therefore denies the next request to that Module without a logout and without affecting any other Module the User holds.

Denials for a known User are recorded in System Logs as "Denied a System request". Handles, secrets and codes are never logged.

### Logout scope

Logout is **per browser session**. Signing out in the portal ends the original central session; every handle that was issued from it, in all four Systems, is denied on its next validation (and is also marked revoked). Handles issued from a *different* browser session of the same User are unaffected. Systems hold no independent authoritative session, and there is no all-devices logout.

**Sending a User to log out.** A System's sign-out button answers its own POST with a `303` to `<portal>/logout`. That page runs the portal's sign-out Server Action (so it carries the portal's own Origin and clears the session cookies), ends the central session, revokes the handles issued from it, and lands on `/login`. A bare route handler is not used: a browser navigation from a System carries no Origin, so the sign-out would not clear the session.

## Example consumer flow

1. Create a random `code_verifier` and `state`; keep both server-side, tied to the browser.
2. Redirect the browser to the authorize URL with `S256(code_verifier)`.
3. On the callback, check `state`, then `POST` the exchange from the backend.
4. Store the `handle` server-side only. It is not a session that stays valid by itself.
5. On every protected request, call validate with the handle and Module; serve the request only on `200 active`. On any other response, including a network failure reaching the portal, deny.

## Testing

`handoff.test.ts` drives the endpoint handlers with a simulated System backend and covers a valid handoff and rejection of expiry, replay, concurrent reuse (exactly one winner), wrong-System, bad backend authentication, tampered state/callback/PKCE, unregistered callbacks, and ineligible or unauthorized Users. `prisma-ports.integration.test.ts` checks the real database's atomic consumption; it runs only when `SEED_TEST_DATABASE_URL` points at a disposable Neon branch.

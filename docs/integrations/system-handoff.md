# System sign-in handoff

How a registered System lets a User who is already signed in to the portal enter it, without the System ever seeing the User's password or the portal's session cookies.

**Status.** This is the portal side of the contract only, exercised by a simulated System backend in `lib/integrations/handoff.test.ts`. It is **not** a complete OIDC provider, and **no real System (CRMS, HRMS, POS, IMS) is integrated yet**. Seeded System URLs, including the placeholders, are never trusted as callbacks. Per-request live validation and logout revocation are documented below.

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
- No session: `302` to `/login`. Awaiting first login: `302` to `/change-password`. (Returning to the original request afterwards is #27.)
- Failures are JSON, never a redirect to an unregistered callback: `400 invalid_request` (unknown System, unregistered callback, missing/invalid parameters), `403 access_denied` (ineligible or no grant in that System).

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
{ "active": true, "user_id": "…", "system": "CRMS", "module": "Customer Profiles" }
```

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

## Example consumer flow

1. Create a random `code_verifier` and `state`; keep both server-side, tied to the browser.
2. Redirect the browser to the authorize URL with `S256(code_verifier)`.
3. On the callback, check `state`, then `POST` the exchange from the backend.
4. Store the `handle` server-side only. It is not a session that stays valid by itself.
5. On every protected request, call validate with the handle and Module; serve the request only on `200 active`. On any other response, including a network failure reaching the portal, deny.

## Testing

`handoff.test.ts` drives the endpoint handlers with a simulated System backend and covers a valid handoff and rejection of expiry, replay, concurrent reuse (exactly one winner), wrong-System, bad backend authentication, tampered state/callback/PKCE, unregistered callbacks, and ineligible or unauthorized Users. `prisma-ports.integration.test.ts` checks the real database's atomic consumption; it runs only when `SEED_TEST_DATABASE_URL` points at a disposable Neon branch.

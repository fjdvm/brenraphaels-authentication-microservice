# System sign-in handoff

How a registered System lets a User who is already signed in to the portal enter it, without the System ever seeing the User's password or the portal's session cookies.

**Status.** This is the portal side of the contract only, exercised by a simulated System backend in `lib/integrations/handoff.test.ts`. It is **not** a complete OIDC provider, and **no real System (CRMS, HRMS, POS, IMS) is integrated yet**. Seeded System URLs, including the placeholders, are never trusted as callbacks. Per-request live validation and logout/revocation are separate work (#26).

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

The handle is opaque, bound to the System and to the original central session, and stored hashed. Treat it as a secret. `expires_in` is the handle's maximum lifetime; whether it may be used is decided by live validation (#26), not by this value.

The code is consumed atomically on the first attempt that presents a valid backend credential for the right System. After that it is dead whatever the outcome, so a failed or tampered attempt cannot be retried with corrected parameters.

| Status | `error` | Meaning |
| --- | --- | --- |
| 401 | `invalid_client` | Missing or wrong backend credentials. Does not consume any code. |
| 400 | `invalid_request` | Missing field. |
| 400 | `invalid_grant` | Unknown, expired, replayed or other-System code; callback, state or PKCE verifier mismatch; the central session has ended. |
| 403 | `access_denied` | The User was Deleted or lost every Module grant in the System since authorization. |
| 503 | `temporarily_unavailable` | The portal could not decide. No handle is issued; retry later. |

Responses carry `Cache-Control: no-store`. Codes, handles and secrets are never written to System Logs or other diagnostics; the log records only that an authorization or exchange succeeded or failed, and why in coarse terms.

## Example consumer flow

1. Create a random `code_verifier` and `state`; keep both server-side, tied to the browser.
2. Redirect the browser to the authorize URL with `S256(code_verifier)`.
3. On the callback, check `state`, then `POST` the exchange from the backend.
4. Store the `handle` server-side only. Do not treat it as a session that stays valid by itself: once live validation exists, every protected request must be validated centrally, and a validation outage must deny the request.

## Testing

`handoff.test.ts` drives the endpoint handlers with a simulated System backend and covers a valid handoff and rejection of expiry, replay, concurrent reuse (exactly one winner), wrong-System, bad backend authentication, tampered state/callback/PKCE, unregistered callbacks, and ineligible or unauthorized Users. `prisma-ports.integration.test.ts` checks the real database's atomic consumption; it runs only when `SEED_TEST_DATABASE_URL` points at a disposable Neon branch.

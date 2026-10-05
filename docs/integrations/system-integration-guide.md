# System integration guide

For the engineer connecting POS, CRMS, IMS or HRMS to the portal. It walks the whole path once, in the order a System backend meets it, and points at a runnable reference. The wire-level contract (parameters, status codes, lifetimes) is in [system-handoff.md](./system-handoff.md); this guide does not repeat it, it says what to *do* with it.

**Status.** The portal side is built and tested against a simulated System. **No real System is integrated yet.** Connecting each one is a separate, later phase (see [verification.md](./verification.md#what-is-still-outstanding)). The portal is not an OIDC provider and the reference is not production code.

## The model in one paragraph

The portal owns the session and each User's Module access. A System never has its own authoritative session. It trades a one-time code for an opaque **handle**, and then asks the portal, **before every protected request**, whether that handle may use that Module *right now*. Central logout, Module revocation and User deletion therefore take effect on the next request, and if the portal cannot answer, the System denies.

## Run the reference

`reference/system-consumer/` is a System backend with no dependency on the portal code.

- `consumer.ts` is the part to copy: `startSignIn()`, `completeSignIn(callbackUrl)`, `authenticate(sessionId, module)`.
- `server.ts` wraps it in a small HTTP server so you can watch a real browser flow.

Against a **development or disposable database only** (registering replaces the System's callbacks and rotates its secret):

```bash
npm run system:register -- CRMS http://localhost:4000/auth/callback   # prints the secret once
npm run dev                                                            # portal on :3000 (separate terminal)
SIM_BACKEND_SECRET=iss_… npm run system:simulate                       # simulated CRMS on :4000
```

Open `http://localhost:4000/modules/Dashboard`. Signed out, you are sent through central login and returned. Signed in to the portal, you land straight in. Then try: log out of the portal and refresh the module page; revoke the Module in User Management; delete the User; stop the portal. Each is denied on the next request. Settings: `SIM_SYSTEM_NAME`, `SIM_PORTAL_URL`, `SIM_PORT`, `SIM_MODULE`.

The same consumer is driven by `lib/integrations/lifecycle.test.ts`, so what the README describes is what is tested.

## Steps

### 1. Credentials and configuration

An operator registers the System: `npm run system:register -- <SYSTEM> <callback> [...]`.

- Callbacks are exact-match, absolute `https` URLs (`http` only for `localhost`). Registering replaces the whole list. Seeded System URLs are never trusted as callbacks.
- The printed `iss_…` secret is shown **once** and only its hash is stored. Put it in the System backend's secret store (a server-side environment variable or secret manager). Never put it in browser code, a repository, a log, or a URL. Re-registering rotates it, which immediately invalidates the old one.
- The System needs three values: the portal origin, its registered name, and that secret.

### 2. Start sign-in (browser → portal)

Create a random `code_verifier` and `state`, keep both **server-side** tied to this browser, and redirect to `/api/integrations/authorize` with `S256(code_verifier)`. Use the same redirect for both entry points:

- **Direct entry**: a User opens the System with no session of yours. Redirect them to authorize; the portal shows central login (and a forced password change if they are Awaiting first login) and brings them back.
- **Portal launch**: a User clicks the System's card. Same redirect; their portal session is live, so the code comes straight back.

Both use the same central session, so signing in to one System does not require signing in again to another.

### 3. Callback and exchange (backend → portal)

On the callback, reject unless `state` is one you started and is unexpired, then `POST /api/integrations/exchange` from the **backend** with the code, verifier, exact callback and state, authenticated with `Authorization: Basic base64(SYSTEM:secret)`. Store the returned `handle` server-side, keyed by your own session id; give the browser only that id. The code is spent by the first attempt whatever the outcome, so on any failure start over from step 2 instead of retrying.

### 4. Authenticate every protected request

Call `POST /api/integrations/validate` with the handle and the Module being requested, before serving it. **Serve only on `200` with `active: true`.** Do not cache or remember a decision between requests, and do not extend your own session timeout past the portal's. `expires_in` is a ceiling, not permission.

### 5. Handle every answer

| Portal says | Meaning | Do |
| --- | --- | --- |
| `200 active` | Allowed now. | Serve this request only. |
| `401 invalid_handle` | Logged out, expired, revoked, or not yours. | Discard the handle, restart sign-in. |
| `403 access_denied` | User Deleted, awaiting password change, or no active grant on this Module. | Show a no-access page. **Keep** the handle: if an Administrator restores access, the same sign-in works again. Re-login will not help. |
| `503`, timeout, network error, anything unrecognized | The portal could not decide. | **Deny**, show "temporarily unavailable", retry later (`Retry-After: 5`). Never fall back to the last allow. |
| `401 invalid_client`, `400 invalid_request` | Your credentials or call are wrong. | Deny and alert an operator. Not retryable, and not the User's fault. |

Invalid access (`401`/`403`) and unavailability (`503`) both deny. Distinguish them only so the User sees the right message and you know whether retrying can help. `consumer.ts` returns exactly these as `sign_in_required`, `no_access`, `unavailable` and `misconfigured`.

### 6. Expiry, logout and revocation

- **Code**: 60 s, single use. **Login-resume token** (`ri`): 15 min, held by the portal, you never see it. **Handle**: at most 8 h, and only valid while its central session is.
- **Logout** is per browser session: central logout ends that session and every handle issued from it, in all Systems, is denied on its next validation. There is no all-devices logout. A System's own "log out" only forgets its local session id.
- **Module revocation** denies the next request to that Module only. **Deletion** denies every Module. **Restore** or re-granting makes the same handle work again, from the retained grants.

## Never do this

- Treat a visible portal card, a signed token, a cookie, or a previous `200` as proof of access.
- Send the portal's session cookie anywhere, or ask for it. Systems never see it.
- Accept a callback or redirect target that is not on the registered list.
- Log the code, verifier, handle or secret.
- Allow because the portal is slow or down.

# System sign-in handoff

How a System (CRMS, later POS/IMS/HRMS) is handed a signed-in Staff member. The Portal stays the
authority: a System never sees the central session cookie or the password. See
`docs/adr/0001-central-session-authority.md`. Live per-request validation and logout revocation
are specified there and are not part of this document yet.

## Registration

A System is trusted only through its registered **callbacks** (`SystemCallback`) and a backend
**secret** (`System.secretHash`). Both come from `prisma/seed.ts` and `lib/seed-data.ts`; re-running
the seed upserts them and never creates a duplicate System or resets access.

| System | Origin                       | Callbacks                                                                                          |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| CRMS   | `https://epic-crms.vercel.app` | `https://epic-crms.vercel.app/api/portal/callback`; `http://localhost:3000/api/portal/callback` (non-production only) |

HRMS, POS and SCMS have placeholder origins and no callbacks, so they cannot complete a handoff.
Callbacks match exactly (no prefix, query, trailing slash or subdomain tolerance).

## 1. Authorize (browser)

`GET /api/integrations/authorize` with query parameters:

- `system` — System name, e.g. `CRMS`
- `redirect_uri` — a registered callback
- `state` — request correlation, echoed back and checked again at exchange
- `code_challenge` — `base64url(SHA-256(code_verifier))`
- `code_challenge_method` — `S256`

Outcomes:

- Invalid parameters or an unregistered callback: `400 {"error":"invalid_request"}`; never redirected.
- No central session: redirect to `/login?returnTo=<this request>`; the Portal returns here after sign-in.
- Awaiting first login: redirect to `/change-password?returnTo=<this request>`.
- Deleted, or no active Module in the System: redirect to the callback with `error=access_denied&state=…`.
- Otherwise: redirect to the callback with `code=…&state=…`. The code is valid for 60 seconds and once.

The session is read fresh (the SDK's cookie cache is bypassed). `returnTo` is honoured only when it
is an authorize request.

## 2. Exchange (System backend)

`POST /api/integrations/token`, `Authorization: Basic base64("<SYSTEM>:<secret>")`, JSON body
`code`, `redirect_uri`, `state`, `code_verifier`.

- `200 {"session_handle","expires_at"}` — an opaque handle bound to the System and the central session
  (valid 12 hours). Keep it in an `HttpOnly` cookie; treat it as a bearer secret.
- `401 {"error":"invalid_client"}` — missing/wrong System credentials.
- `400 {"error":"invalid_request"}` — missing fields.
- `400 {"error":"invalid_grant"}` — unknown, expired, replayed (including concurrent), wrong-System,
  mismatched callback/`state`, wrong `code_verifier`, or the Staff member lost access since authorizing.

A code is consumed atomically before its bindings are checked, so a wrong-proof attempt spends it.
A code presented by a different System is left untouched.

## Configuration

Set at seed time (`npm run db:seed`), never committed:

- `SYSTEM_SECRET_CRMS` — the CRMS backend's secret (at least 32 random characters, e.g.
  `openssl rand -base64 32`). Only its SHA-256 hash is stored. Give the same value to CREOMS as its
  backend credential. Omitting it leaves the stored hash unchanged.

## Tests

`lib/integrations/handoff.integration.test.ts` drives the real route handlers against an isolated
Postgres, faking only the Neon Auth session lookup. It is skipped unless a database is given:

```sh
docker run -d --rm --name handoff-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=handoff -p 54329:5432 postgres:17-alpine
DATABASE_URL=postgresql://postgres:test@localhost:54329/handoff DIRECT_URL=$DATABASE_URL npx prisma migrate deploy
HANDOFF_TEST_DATABASE_URL=postgresql://postgres:test@localhost:54329/handoff npm test
```

# HRMS Account request receiver (fjdvm/hrms#331)

Contract: https://github.com/fjdvm/hrms/issues/315#issuecomment-6833529748.
Paths match HRMS's `lib/portal/account-requests.ts`. Both endpoints require
`Authorization: Basic base64(HRMS:<registered system secret>)`; other Systems
cannot read this cross-System matrix or submit requests. Responses are `no-store`.

- `GET /api/integrations/account-requests/options` returns `{ roles: [{ id, name,
  moduleIds }], systems: [{ id, name, modules: [{ id, name }] }] }`. Retired Modules
  are excluded from both lists and Role templates.
- `POST /api/integrations/account-requests` accepts `{ reference, employee: {
  name, workEmail, personalEmail, mobile, position, branch, startDate }, roleId,
  moduleIds, neededFrom, note, requestedBy: { name } }`. Dates are ISO calendar
  dates. `mobile` and `note` may be null; Module selection may be empty.
- Success is `201 { reference, status: "new" }`; repeat delivery returns `200`
  with the saved status, without changing the request or notifying again. References
  are unique per source System. The first accepted payload wins.
- Invalid payload or unknown Role/retired Module: `400`; bad secret: `401`;
  existing User work email (including Deleted Users) or an active request for that
  email: `409 { error: "email-taken" }`; database unavailable: `503`.
- Email comparison is case-insensitive. A partial unique index serializes competing
  active requests, and a unique reference index serializes duplicate deliveries.
- Every new request sends an inbox notification to all non-deleted Users whose
  Role is administrative, following the Portal's existing best-effort delivery
  policy. Notification service outages are logged and do not reject saved requests.

Portal status labels are `new`, `seen`, `created`, `declined`, `cancelled`.
The administrator request list and detail are implemented by hrms#334.
Creation and outgoing status delivery are implemented by hrms#335 as described below.

## Migration

Apply only `20261114000000_account_requests` with the configured direct connection:

```sh
npx prisma db execute --file prisma/migrations/20261114000000_account_requests/migration.sql
npx prisma migrate resolve --applied 20261114000000_account_requests
```

Do not use `migrate deploy` on the configured production database: the unrelated
pending `20261021000000_remove_system_log` drops an old table. Do not run the seed.
The new table, enum, foreign keys and indexes are additive; rolling back app code
can leave them in place. No existing Users, grants or templates are rewritten.

Tests call the HTTP handlers using a fake HRMS sender and in-memory Postgres
running the real migration and parameterized persistence queries. They cover bad
secrets, concurrent delivery, User/active-request email collisions, templates,
retired Modules, empty selections and retries after account creation.

Verified on 2026-11-13 (Manila): the migration succeeded on a temporary branch of
production (`ticket-hrms-331-migration-test`, expiring automatically), then was
applied to the configured Portal database and recorded with Prisma. The unrelated
System Log removal remains pending. Local validation: typecheck, targeted ESLint,
Prisma validation, both endpoint test files, and the full suite (570 passed,
23 skipped). Standards review found no violations; spec review found no gaps.

## Create from request (fjdvm/hrms#335)

Opening a request commits Seen and its outgoing event once. Create account opens
`/admin/users/new?request=<id>` using the existing User form with the requested
Role and Modules prefilled; the administrator can adjust names, Role and Modules.
The work email remains the request's authoritative User email. A single-name
request needs a last name entered before creation, as for every other User.

A five-minute per-request delivery lease prevents resends from replacing the password
while the initial credentials are being emailed; SMTP operations have bounded timeouts.
A crashed sender leaves a lease the administrator can retry after expiry.

A transaction claims an open request, advances the normal Username sequence,
inserts the User and AccessGrants, links the User, marks Created, and saves an
`account_created` outbox event. Competing creation/cancellation cannot both win.
The same temporary credentials are emailed to work and personal addresses
(deduplicated when equal). Only confirmed delivery to both records `login_sent`.
Email failure retains the account and exposes Resend login details in the request;
resending replaces the password using the existing credential issuer and sends
both addresses. Passwords are never persisted in the outbox.

`AccountRequestDelivery` stores `{ reference, status, actor, occurredAt }`.
`actor` is the Portal administrator's User ID. Configure `HRMS_SYSTEM_SECRET`
with HRMS's `PORTAL_SYSTEM_SECRET` and `HRMS_ACCOUNT_REQUEST_WEBHOOK_URL` with
`https://hrms.buildwrite.me/api/portal/account-requests/status` (receiver hrms#336).
The deploy manifest reads these GitHub secrets through `.env.production.example`.
Pushes use Bearer authentication, a ten-second timeout, and refuse redirects.
Each unacknowledged push retries with exponential delays capped at five minutes,
without an attempt limit. A 2xx removes it. Startup reloads pending deliveries;
newly committed events start delivery directly without another outbox read. Multiple replicas may deliver the
same event, which the HRMS contract explicitly allows. A failed startup outbox
read fails server initialization so the container can restart; there is no idle
query timer. Failed status pushes are delivery retries, not application polling.

Apply only the additive migration, preserving the unrelated pending System Log
removal and avoiding the seed:

```sh
npx prisma db execute --file prisma/migrations/20261115000000_account_request_fulfillment/migration.sql
npx prisma migrate resolve --applied 20261115000000_account_request_fulfillment
npx prisma db execute --file prisma/migrations/20261115010000_account_request_delivery_lease/migration.sql
npx prisma migrate resolve --applied 20261115010000_account_request_delivery_lease
```

Tested first on production child branch `ticket-hrms-335-fulfillment-test`
(expiring 2026-11-14 UTC), using the real Prisma transaction and fake identity,
mail and HRMS services. Covers Seen idempotency, competing creation, grants,
normal Usernames, dual delivery, and retaining Created on personal-email failure.

## Remind and cancel (fjdvm/hrms#343)

- `POST /api/integrations/account-requests/{reference}/remind` notifies current,
  non-deleted Administrators in-app for New/Seen requests. HRMS enforces its
  once-per-24-hours reminder limit. The body is unused.
- `POST /api/integrations/account-requests/{reference}/cancel` atomically changes
  New/Seen to Cancelled and records `cancelledAt`. Repeated cancellation succeeds.
  Existing administrator actions only claim New/Seen requests, so a cancelled
  request cannot be created or declined. Account creation and cancellation lock
  the same row; only one can win.
- Both use the same HRMS Basic authentication and `no-store` responses. Unknown
  references return `404`, malformed references `400`, invalid credentials `401`.
  Terminal requests return `409 { status }`, mapping Created to `account_created` or `login_sent` after confirmed delivery.
  Successful cancellation returns `200 { status: "cancelled" }`.
- This uses the existing schema; no migration or production data change is needed.

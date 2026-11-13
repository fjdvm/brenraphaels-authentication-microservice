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
The admin review/actions and outgoing HRMS webhooks belong to later tickets;
`created` will map to HRMS `account_created`. This ticket adds no UI or polling.

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

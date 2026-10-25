# Ticket #91: Portal display caches

## Boundaries

| Read | Server revalidation / hard expiry | Authority |
| --- | --- | --- |
| Users list and Role/AccessTemplate form options | 150 / 180 seconds | Administrator checked outside the cache |
| System Logs, My Logs, log filter options | 15 / 30 seconds | Current viewer checked before cache lookup; My Logs key includes the session's Actor |
| Portal System cards, edit AccessGrants, sign-in, central sessions, integration validation and exports | Uncached | Current database/provider state |

These are `use cache: remote` caches under Next.js Cache Components, using the
hosting provider's shared cache handler (Vercel in this repo). Cache lifetimes set
`stale: 0` so cached display data does not opt authenticated pages into a reusable
browser App Shell. Live session and Role guards still execute on each request.
React's existing `cache()` deduplicates only within that request. Both session
readers bypass Neon Auth's session-data cookie cache.

All display reads share a tag. Audit writes expire it even if audit delivery fails;
Administrator write actions also expire it in `finally` to cover partial failures.
Notification read markers and forwarded Auth POSTs expire it as well. Invalidation
uses `revalidateTag(tag, { expire: 0 })`, supported in both Actions and Route Handlers,
so the next request blocks for fresh data. Existing path invalidation remains.
An external System's audit writes are picked up within the 30-second log expiry.

## Migration

Enable `cacheComponents`, remove the four obsolete `dynamic = "force-dynamic"`
exports, and provide a root Suspense boundary for uncached request-time work.
The installed Next.js caching, migration, authentication, remote-cache, cacheLife,
and tag invalidation guides were read before implementation. No schema changes,
SQL migrations, seed changes, or new infrastructure credentials are needed.
A deployment is needed to activate the shared caches.

## Checks on the deployment

The parent spec #87 reserves cache timings for a real deployment, outside Vitest.
Record these on #87 after deploying this PR, from the same Philippines connection
used for the baseline:

1. As an Administrator, time first load and revisit of Users, System Logs and My
   Logs. Revisit Users within three minutes; confirm the warm read avoids another
   database list query using deployment traces.
2. Create a User, change a Role/AccessGrant, delete/restore, resend credentials, and
   complete a password change/reset. Revisit Users from another signed-in browser;
   confirm changes are visible on the next request, including a failed resend
   after the User was marked Awaiting first login.
3. Write an event from an external System. Re-request the same log filters after
   30 seconds; confirm the event appears. Retry with another filter and cursor.
4. Switch Users for My Logs; confirm each sees only their own events. Demote the
   Administrator or delete the User; confirm warm log data cannot bypass guards.
5. Validate a Module successfully, revoke it, then repeat the identical validation
   request and handle: expect 403 with `Cache-Control: no-store`. Another retained
   Module stays accessible. Revoke the central session; expect 401 next request.

No live timings are claimed by the unit suite. Regression tests exercise revoked
sessions at the session guard and repeated Module/session validation through the
production Prisma adapter, with the database/provider boundaries simulated.

## Compiled-runtime regression evidence

Run `npm run build`, then
`SEED_TEST_DATABASE_URL=<disposable-branch-url> npm run test:access-cache`.
The script launches the compiled Next production server against that branch,
creates isolated fixtures, sends repeated identical HTTP validation requests,
revokes the Module directly in the branch without cache invalidation, and checks
that access is denied immediately. It also checks a retained Module and central
session revocation. Fixtures are removed and the server is stopped afterwards.
The branch must already have the repo's migrations and Neon Auth schema.

Passed on 2026-10-25 against the isolated Neon branch
`ticket-91-cache-verification` (`br-polished-glitter-b3zm1tne`), configured to expire
on 2026-10-26. Output:

```text
PASS compiled Next: warm Module 200 → revoked 403; retained Module 200 → revoked session 401; all no-store
```

This exercises real Next compilation/caching and the real database adapter;
it complements the faster Vitest checks, where cache directives are not compiled.
It does not measure Vercel cache hit rates or deployment latency.

## Existing migration status

The migration-status check found `20261021000000_remove_system_log` pending on
production. It drops `SystemLogEvent` and `SystemLogOutcome`, including the old
local audit history, with no backfill. This predates #91 and is not required for
its cache changes. It was applied successfully on the disposable branch and the
compiled-runtime check passed again afterwards. It remains unapplied on
production; a production rollout of that destructive cleanup is outside #91.

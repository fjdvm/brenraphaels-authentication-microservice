# Password recovery verification (ticket #5)

The login link, forgot-password page, reset form, and `/login?reset=1` notice
already existed. This change completes expiry enforcement, token-owner checks,
recovery from invalid links, and the agreed Server Action tests with real Postgres.

## Live Neon Auth check — 2026-10-23

Verified on the disposable `ticket-5-password-reset-test` branch
(`br-muddy-shadow-b3xs7zil`) of project `still-tree-95543274`.
Only disposable Auth Users had credentials reset.
No production User credentials were changed.

1. Called the real `/request-password-reset` endpoint with a redirect containing
   `e` (Email) and `s` (the Portal's HMAC signature). Response: **200**.
2. Read the issued token from the branch's `neon_auth.verification` table. Followed
   the real `/reset-password/{token}?callbackURL=<original signed redirect>`
   endpoint with automatic redirects disabled. Response: **302**. The Location
   preserved `e` and `s` exactly and appended the correct `token`.
   Then repeated with a disposable inbox: received the actual Neon reset email,
   followed its emitted URL, and verified the **302** Location preserved the
   original Email and signature and appended the token. This covers email
   generation as well as the callback; no URL was reconstructed in this check.
3. Submitted the token to the real `/reset-password` endpoint. Response: **200**.
   Reusing it returned **400**.
4. Before the migration, issued tokens lasted **3600 seconds**. Setting upstream
   Better Auth's `resetPasswordTokenExpiresIn` in managed configuration did not
   change that lifetime. That experimental setting was removed from the test branch.
5. After the migration, a fresh provider-created token lasted exactly **900 seconds**.
   The token from the delivered email also lasted **900 seconds**. Its real reset
   returned **200**, followed by **400** on reuse. An expired token returned **400**.
6. Linked that disposable Auth User to a temporary Portal User. After marking them
   Deleted, the real provider rejected both an outstanding token and a new token
   requested directly through Neon (**400** in both cases). Temporary Portal
   fixtures were removed afterwards.

## Migration

`20261023000000_password_reset_expiry` adds a trigger on
`neon_auth.verification` that caps `reset-password:` rows at creation plus 15
minutes, including outstanding links. Deleted Users' new tokens expire immediately;
   a second trigger invalidates outstanding tokens when a User becomes Deleted.
   This also protects the provider's public API from bypassing the Portal action.
   Other verification lifetimes are untouched.
Neon Auth continues to issue, email, validate, and consume tokens. The Portal also
checks token ownership, lifetime, and the Deleted flag on page load and submission.
A verifying signature activates only the User who owns that token. A missing,
tampered, or mismatched signature allows password reset without activation.

Apply with `npx prisma migrate deploy` using the direct database URL. If unrelated
older migrations remain pending, apply this migration's SQL alone with
`npx prisma db execute --file prisma/migrations/20261023000000_password_reset_expiry/migration.sql`
and then `npx prisma migrate resolve --applied 20261023000000_password_reset_expiry`.
This avoids applying unrelated pending work. Both commands use `DIRECT_URL`
through `prisma.config.ts`.

The trigger relies on the current managed Neon verification schema. Recheck this
flow when upgrading the provider. Plain Postgres databases without Neon Auth skip
the trigger installation; they cannot run the password-recovery integration suite.
Both functions use `SECURITY DEFINER` with `search_path = pg_catalog` and qualified
   table names because the provider's restricted role cannot read Portal Users.
   Rollback: drop `limit_password_reset_expiry` on `neon_auth.verification` and
   `expire_deleted_user_password_resets` on `public."User"`, then drop their matching
   functions in `public`. Previously shortened links stay shortened.

## Automated checks

Run `npx vitest run actions/auth.test.ts` for the fast Server Action tests.
Run `SEED_TEST_DATABASE_URL=<disposable Neon URL> npx vitest run actions/password-reset.integration.test.ts`
after applying migrations to that branch for real-database coverage. The suite
creates and removes its own fixtures and fakes Neon Auth only at its API boundary.
It skips when the dedicated URL is absent. Never supply the production database.

The full database suite must run with a direct test URL and `--no-file-parallelism`,
because existing suites each invoke Prisma Migrate and share advisory locks.
The Vitest configuration transforms the Neon SDK so its extensionless Next.js
imports resolve when these integration suites load server modules.

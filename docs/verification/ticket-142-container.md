# Portal standalone container

Ticket: #142. This builds and tests the image; no image is published and no deployment is made.

```sh
docker build -t portal:local .
docker run --rm -p 3000:3000 --env-file /path/to/runtime.env portal:local
curl --fail http://localhost:3000/api/health
```

Use `.env.production.example` as the runtime key list. `NEXT_PUBLIC_APP_URL` is supplied
at runtime, so changing the public address does not require rebuilding the image
(updated by #231). The build uses non-secret placeholders for route collection and needs no database or Auth access.
Prisma Client is generated during the build. Runtime starts with `node server.js` as
the unprivileged `node` user; static and public assets are included. `PORT` defaults to
3000 and `HOSTNAME` to `0.0.0.0`. The platform probe is `GET /api/health` (anonymous,
200 with `{"status":"ok"}`). It is a process liveness check, independent of external
database, Auth and shared-service availability.

Apply schema migrations separately before running a new revision. The small runtime
image does not include the Prisma migration CLI, source tree, dev dependencies or
environment files. Use a checkout with `npm ci` and `DIRECT_URL` set to run
`npx prisma migrate deploy`; runtime only needs `DATABASE_URL`.

## Repeat the CI smoke test locally

Requires Node 24, npm, Docker Compose and OpenSSL. No cloud secrets are needed.

```sh
npm ci
npx prisma generate
docker build -t portal:ticket142 .
bash scripts/container-smoke/run.sh
```

The script creates a unique Compose project, disposable PostgreSQL, a Neon WebSocket
proxy behind TLS, and a fixture Auth provider. A short-lived local certificate is
trusted using `NODE_EXTRA_CA_CERTS`; TLS verification stays enabled. Migrations run
against the disposable database, then one non-administrator User is inserted. The
fixture provider recognizes one test session token, while the Portal's real SDK,
session guards and Prisma reads execute unchanged. Other shared services return 503,
exercising the home's existing fallback behavior. This does not verify the hosted
Neon Auth login UI or the shared services.

The HTTP checks require an anonymous health response, an anonymous home redirect to
login, a signed-in home showing the database-backed User and Username, and working
static/public assets. Containers, volumes and generated certificates are removed on
success or failure; container logs are printed on failure. Random host ports avoid
colliding with a running development server.

`.github/workflows/container.yml` runs the unchanged test suite, typechecks, builds
with `npm ci`, runs this smoke test, and records the uncompressed image size in the
job summary. The size must stay below 400 MiB. Database integration tests retain
their existing opt-in environment requirements; the container smoke always uses a
real disposable database and cannot silently skip.

## Local verification — 2026-11-09

- A fresh Docker dependency stage completed `npm ci`: 796 packages installed.
- The production build generated Prisma Client 7.10.0, passed TypeScript, and
  produced standalone output with only the public URL build argument.
- Linux amd64 image `portal:ticket142`: **403,360,568 bytes (384.7 MiB)** as reported
  by `docker image inspect --format '{{.Size}}'`, below the 400 MiB CI ceiling.
- `bash scripts/container-smoke/run.sh` passed all HTTP checks against migrated,
  disposable PostgreSQL. The fixture stack and certificates were removed afterward.
- Full unchanged Vitest suite: **508 passed, 21 skipped** (51 files passed, 7 skipped).
  Skipped suites require external Neon/Auth integration credentials, which were
  unavailable for this run. Those suites have not been verified; the container smoke
  does not replace them. Focused proxy tests, ESLint on changed TypeScript/JavaScript,
  shell syntax and a separate TypeScript check passed.

Verification used a temporary clean source copy containing this ticket's changes.
Pre-existing uncommitted edits to `lib/seed-data.ts` and `prisma/seed.test.ts` fail
typechecking independently and were preserved outside that copy and this commit.
The GitHub Actions workflow has been prepared and locally reproduced; it has not
been run remotely or deployed.

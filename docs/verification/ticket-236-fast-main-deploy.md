# Ticket #236: parallel main checks and deployment build

## Implementation

`main` pushes classify the full push `before`-to-`after` diff, including deletions
and both sides of renames. PRs continue to use their merge base. Manual runs and
new-branch pushes without a before commit fail safe to code checks.

For code pushes, `checks` and `production-image` depend only on `changes` and run
in parallel. The production build pushes the merged commit image and returns its
immutable digest. `ci-gate` requires both jobs to pass and requires smoke to be
skipped. Deploy depends on the classifier, checks, image and gate. Failed or
cancelled checks therefore prevent Azure login and revision creation.

For docs-only pushes, checks, smoke, image and deploy all skip; the gate verifies
the expected skips. PR and manual code runs retain their image smoke test. Azure
login, manifest rendering, revision creation, domain binding verification, public
health checks and the `portal-production` deploy concurrency group are retained.
Health polling changes from 60 attempts at 10 seconds to 200 at 3 seconds,
retaining the approximate ten-minute wait budget.

The separate build runner persists the Next.js cache mount after a successful
image build, before deployment. PRs still restore only. Docker dependency cache
publication remains after a successful deploy, using the same scope and
`dependencies` target with `mode=min`. That export now runs on a fresh builder
which imports the shared cache; a changed lockfile can require another dependency
install, but it does not rebuild the application image or delay revision health.

## Local verification and review

- `npx tsc --noEmit`: passed twice.
- `npx vitest run scripts/ci/classify-changes.test.ts`: 27 passed.
- `npm test`: 550 passed, 23 skipped; 53 files passed, 9 skipped.
- actionlint v1.7.7 and `git diff --check`: passed.
- Independent Standards and Spec reviews against `f2b520f`: no implementation
  findings. Live deployment acceptance remains pending below.

The parent spec names the classifier as the automated test seam; the workflow is
verified with real Actions runs rather than mocked orchestration tests.

## Real push acceptance probes

Temporary branch `ticket-236-push-probe` uses the production workflow with its
push/ref filter pointed at that branch. The checks job deliberately runs TypeScript
against a temporary file assigning a string to a number. The production image
build uses unchanged application code. No probe merges into `main`.

- [Docs-only push run 42701914258](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42701914258),
  commit `4c00455`: **success in 14 seconds**, from 21:22:38 to 21:22:52 UTC on
  2026-11-09. Only a Markdown file changed. `changes` and `ci-gate` succeeded;
  `checks`, `container-smoke`, `production-image` and `deploy` all skipped.

- [Failing-typecheck push run 42701876256](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42701876256),
  commit `7d44f3b`: checks and production image started together at 21:22:35 UTC.
  TypeScript rejected the intentional assignment and checks failed after **1m35s**.
  Smoke skipped. The image build was cancelled after over twelve minutes because
  its cached dependency layer downloaded at about 0.2 MB/s: only **153.09 MB of
  549.56 MB** after **734.6 seconds**. The application build never started.
  `ci-gate` failed; deploy was cancelled with no steps executed. This proves the
  negative path did not deploy, but does **not** establish successful-image
  failure gating or the target build/deploy duration. Repeat that acceptance run
  when cache downloads are healthy.
- Before the probe, production was `portal--gh-42700317063-1` with public health
  passing. A later read showed `portal--gh-42702486318-1`, also with `SniEnabled`
  custom-domain binding and public health `{ "status": "ok" }`. The probe ran no
  Azure steps, but an independent rollout means unchanged-revision acceptance
  cannot be claimed from these before/after snapshots.

Temporary probe branches are removed after recording the runs. PR #247 was
already merged before #236 began, so the implementation is in follow-up PR #251.

## Acceptance after merge

A real code merge's merge-to-healthy duration (target 3–3.5 minutes), a real
docs-only merge, and the post-deploy domain binding and public health checks
remain pending. Branch push probes establish event routing and failure gating,
not production rollout timing. The parent spec says agents must never wait for
production deploys; this PR does not merge itself or trigger a production deploy.

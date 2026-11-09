# Ticket #234: docs-only PR checks

## Implementation

The always-running `changes` job uses the classifier from #230 against the PR's
merge-base-to-head diff. Deleted files and both paths of renames are included;
NUL delimiters preserve unusual filenames. No dependency installation is needed.
Only a successful `docs-only` classification allows `checks` and
`container-smoke` to skip. The always-running `ci-gate` verifies those skips,
requires both jobs to succeed for code, and fails on failed classification or
unknown output. Push and manual runs keep their full checks.

## Local verification

- `npx vitest run scripts/ci/classify-changes.test.ts`: 27 passed.
- `npx tsc --noEmit`: passed.
- `npm test`: 550 passed, 23 skipped across 62 files (53 passed, 9 skipped).
- `actionlint` v1.7.7: passed.
- Standards review: no findings. Spec review: implementation correct; acceptance
  runs recorded below.

## Real PR acceptance runs

Probe PRs target the implementation branch, so they exercise the new workflow
without merging it into `main`. Both probes were closed without merging. The mixed
implementation PR targets `main`. No production deployment is needed.

| Diff | PR | Run | Result | Time from run creation to gate completion |
| --- | --- | --- | --- | --- |
| Only `docs/verification/ticket-234-probe.md` | [#248](https://github.com/fjdvm/brenraphaels-authentication-microservice/pull/248) | [42694477865](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42694477865) | `changes` and `ci-gate` succeeded; `checks` and `container-smoke` skipped | **16 seconds** (20:35:49–20:36:05 UTC, 2026-11-09) |
| Workflow + classifier documentation | [#247](https://github.com/fjdvm/brenraphaels-authentication-microservice/pull/247) | [42694430978](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42694430978) | Full checks and `ci-gate` succeeded | **5m 35s** |
| Only `.github/workflows/container.yml` | [#249](https://github.com/fjdvm/brenraphaels-authentication-microservice/pull/249) | [42694505621](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42694505621) | Full checks and `ci-gate` succeeded | **5m 17s** |

Both code cases completed the image build, size check and disposable-database
container smoke test. Typecheck and unit tests ran in parallel with the container
job. The workflow-only case proves workflow changes do not skip checks. Dockerfile
classification is also covered by the existing classifier tests.

The unrelated Vercel check reports “Account is blocked.” This is separate from
`Portal container` and its `ci-gate` result.

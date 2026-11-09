# CI and deploy measurements — 2026-11-10

Ticket #240, parent spec #229. Collected on 2026-11-10 (Asia/Manila); all run
and merge timestamps below are UTC on 2026-11-09. This report measures existing
runs; it does not trigger or wait for production deployments.

**Observed result:** docs-only PRs reach the gate in 13–16 seconds from workflow creation.
Code PR checks still take 4m15s–5m19s across three real implementation PRs, missing
the roughly three-minute target. The first main run after #236 built its image
and passed checks in 2m46s **but skipped deploy**. Its duration does not prove
merge-to-live improved. The last measured successful deployment used the older
pipeline and took 8m23s from merge to the end of health verification.

## Method and sample boundaries

PR check time is workflow `created_at` to the successful `ci-gate` job's
`completed_at` (or the old smoke job before a gate existed). Workflow wall time
includes final skipped-job bookkeeping; the tables label that separately.
Merge-to-live is merge `mergedAt` to the end of the successful **Deploy and verify**
step. That step checks revision health, default-address health, domain binding and
public health: its end is a conservative upper bound on when the revision first
became healthy, not a measurement of the first healthy instant.

These are three **distinct real code PRs**, not three attempts of one ticket:
#246 implements #230/#231/#232, #247 implements #234/#235, and #251 implements
#236/#239. They span the rollout and are marked by stage below. The first two
cannot establish performance of the final #236 workflow. Real docs-only tickets
#183, #184 and #238 are included; only #238 has the docs-skip optimization. The
#234 probe is additional evidence and is explicitly not a second real optimized
docs ticket. No synthetic PR is counted as a real implementation ticket.

[Follow-up #254](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/254)
tracks the missing final-workflow cohort, skipped deployment diagnosis and owner
billing confirmation. Closing the reporting implementation does not establish
those pending production results.

## Before and after

The spec's before estimates were 5–7 minutes for PRs, 8–11 minutes from merge to
live, and about 15 minutes end-to-end for documentation. These measurements show
that actual timing varies; the estimates are not substituted for observed data.

| Ticket / PR | Stage and changed content | PR run | Checks ready / workflow wall | Rounded runner min (PR) |
| --- | --- | --- | --- | ---: |
| #183 / #227 | Before: docs ADR only | [42636236294](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42636236294) | 5m16s / 5m17s | 6 |
| #184 / #228 | Before: docs alignment only | [42641506088](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42641506088) | 7m14s / 7m15s | 8 |
| #231 (+ #230/#232) / #246 | During rollout: parallel checks/browser cache; workflow, Dockerfile, classifier | [42689593318](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42689593318) | 5m19s / 5m20s | 10 |
| #235 (+ #234) / #247 | During rollout: docs skip/shared Docker cache; workflow and Dockerfile | [42698538728](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42698538728) | 4m40s / 4m41s | 9 |
| #236 (+ #239) / #251 | Final main-pipeline change; workflow and agent docs | [42705350971](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42705350971) | 4m15s / 4m16s | 9 |
| #238 / #250 | After docs skip: documentation of ruleset only | [42702370982](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42702370982) | 13s / 14s | 2 |
| #234 / #248 | Temporary docs-only acceptance probe; not merged | [42694477865](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42694477865) | 16s / 18s | 2 |

For example, the #236 PR was created at 21:44:31, its gate completed at 21:48:46,
and the workflow ended at 21:48:47. The three code PR check samples have median
4m40s; all miss three minutes. The real optimized docs PR meets one minute.
The two pre-optimization real docs PRs demonstrate the previous unnecessary build.

| Ticket / main run | Merge → health verification end | Workflow wall | Rounded runner min (main / PR + main) | Interpretation |
| --- | --- | --- | --- | --- |
| #183: [42637211039](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42637211039) | Not sampled at step level | 8m08s | Not sampled | Before: docs still deployed |
| #184: [42642891309](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42642891309) | 15:15:49 → 15:24:30 = **8m41s** | 8m45s | 10 / 18 | Before: docs still deployed |
| #231: [42693473398](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42693473398) | 20:29:37 → 20:38:27 = **8m50s** | 8m55s | 12 / 22 | Parallel PR checks, main still repeats smoke |
| #235: [42700317063](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42700317063) | 21:12:35 → 21:20:30 = **7m55s** | 8m10s | 14 / 23 | Shared caches; main still repeats smoke |
| #238: [42702486318](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42702486318) | 21:26:13 → 21:34:36 = **8m23s** | 8m41s | 14 / 16 | Docs skip only applied to PR then; main still built/deployed |
| #236: [42706084734](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42706084734) | **Unavailable: deploy skipped** after 21:49:07 merge | 2m46s | 7 / 16 | Final main workflow; passing gate is not proof of deployment |

Per-ticket totals above include one selected successful PR attempt plus its main
run, not the entire ticket's retry/revision history. They measure pipeline
consumption per successful pair, not total development cost. The 16-minute #236
pair is incomplete production work because deployment did not run.

## Cache evidence and remaining critical path

Run logs, not step success alone, establish hits:

- #235 PR run 42698538728: Docker dependency layers report `CACHED`; Next.js
  restore reports **cache not found**. Playwright restore hits
  `Linux-X64-playwright-1.65.0`, takes 6s and skips browser download. The image
  build/load step takes 76s, Chromium system dependencies 36s and smoke 43s.
- #236 PR run 42705350971: Next.js restore hits the key ending in main commit
  `86b62cc4…`; Docker dependency layers report `CACHED`. Image build/load still
  takes 76s. Playwright restore takes 3s and skips download; system dependencies
  take 14s, smoke 51s. Its smoke job takes 238s, while checks take 132s: image
  preparation and smoke remain the critical path. Setup through the start of
  the image build consumes another 80s, including npm install and builder/cache setup.
- #236 main run 42706084734: Next.js restore hits `86b62cc4…`, dependency layers
  report `CACHED`, build/push takes 81s. Production-image job takes 115s and checks
  150s in parallel; smoke is skipped. Deploy is also skipped, unexpectedly.

Browser download avoidance is demonstrated, but none of these observational
samples isolate a causal speedup for Next.js or Docker cache independently.
The 76s image step with and without the Next.js restore hit does not prove a
Next.js speedup. The cold browser install in main run 42693473398 took 11s plus
13s for OS dependencies; it does not substantiate the spec's historical 151s
worst case for these particular samples.

The existing [#236 probe report](../verification/ticket-236-fast-main-deploy.md)
also records a cache download reaching only 153.09 MB of 549.56 MB in 734.6s in
[cancelled run 42701876256](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42701876256).
A cache hit can still be slow; exclude that failed probe from successful-ticket
medians, but retain it as a warning about network variability.

## Targets, likely causes and follow-up

| Target | Result | Likely cause / suggested next step |
| --- | --- | --- |
| Code PR about 3m | Missed: 4m15s–5m19s to gate | Smoke job dominates even with cache hits. Profile npm install, builder initialization, image load and OS dependency setup before proposing further changes. Avoid paid runners without measured justification. |
| Docs PR about 1m | Met: 13s real ticket; 16s probe | Classification and gate alone run. Add a second real docs PR/main pair on final workflow in #254. |
| Merge-to-live about 3–3.5m | Not demonstrated; earlier samples 7m55s–8m50s | Older pipeline repeats smoke before build/deploy. Final pipeline skips deploy entirely; diagnose that first, then remeasure. |
| Roughly 10 Actions min/code ticket, 1–2/docs | Successful earlier code pairs use estimated 22–23 runner min; docs PR is 2, but old docs main adds 14 | Parallelism lowers wall time, not summed runner usage. Two tiny gate/classifier jobs each round up. Obtain actual allowance usage from billing and measure complete final-workflow pairs. |

The likely skipped-deploy cause is GitHub's skipped dependency propagation:
`deploy` needs `ci-gate`, whose ancestry includes deliberately skipped
`container-smoke` on main. Its condition lacks a status function. This is an
inference from workflow structure and the observed skipped job, not a completed
bug diagnosis. GitHub documents [skip propagation through job dependencies](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).
A follow-up fix must explicitly require successful classifier/checks/image/gate
results and reject cancellation while handling that skipped ancestor; adding
`always()` alone would be unsafe. #254 tracks diagnosis and a separately approved
fix before final live timing acceptance.

## Actions minutes and reproducibility

Repository visibility is **private**, queried via `gh api repos/{owner}/{repo}`.
The run timing endpoint returned `billable.UBUNTU.total_ms: 0` and zero durations
for every job in the sampled responses, despite nonzero job timestamps. These
zeros are recorded API values, **not evidence of zero allowance consumption**.
Actual billed/included minutes remain unconfirmed pending the owner's billing
view in #254; no claim is made about total monthly use or remaining allowance.

The tables instead show a reproducible runner-minute estimate:
`sum(ceil((completed_at - started_at) / 60))` over non-skipped jobs, with skipped
jobs contributing zero. Tiny jobs each count one; parallel jobs are summed.
GitHub's [runner pricing reference](https://github.com/github/docs/blob/main/content/billing/reference/actions-runner-pricing.md)
documents per-job rounding. The estimate excludes other attempts, unrelated
workflows, storage and any account billing adjustments.

To reproduce from the linked run IDs using authenticated `gh`:

```sh
gh api repos/{owner}/{repo}/actions/runs/<run-id>
gh api repos/{owner}/{repo}/actions/runs/<run-id>/jobs
gh api repos/{owner}/{repo}/actions/runs/<run-id>/timing
gh run view <run-id> --log
gh pr view <pr-number> --json mergedAt,files,mergeCommit
```

Use `created_at`, job/step timestamps and PR `mergedAt`; do not treat a skipped
job, a cache step's success, `updated_at` alone, or a green workflow as proof that
a production deployment happened. All samples above are existing completed runs;
no new production acceptance is claimed by this report.

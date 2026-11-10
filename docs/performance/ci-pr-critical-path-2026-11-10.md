# PR check critical path — ticket #259

Parent spec #229. Baseline from [#240 report](ci-pipeline-2026-11-10.md): code PR
checks 4m15s–5m19s, median 4m40s, against a ~3 minute target. Free standard
runners only. Times are workflow `created_at` → `ci-gate` `completed_at`.

## Baseline step timings (real code PR, run 42723623470, container-smoke job 4m11s)

| Step | Time |
| --- | ---: |
| setup-node (npm cache restore) | 6s |
| `npm ci` | 78s |
| buildx setup | 7s |
| Next cache restore + mount | 3s |
| Image build and load | 77s |
| Playwright cache restore | 4s |
| Chromium OS dependencies | 14s (36s in run 42698538728) |
| Smoke test | 45s |
| Post steps | ~9s |

`checks` job in parallel: 1m57s, so smoke was the critical path.

## Changes

| Change | Step shortened | Measured saving |
| --- | --- | --- |
| Cache `node_modules` by lockfile hash in `checks` and `container-smoke`; run `npm ci` only on a miss | `npm ci` 53–78s → 11s cache restore | ~42–67s on a hit |
| Use the Chrome preinstalled on `ubuntu-latest` (`SMOKE_BROWSER_CHANNEL=chrome`) | Playwright cache, OS dependencies and browser download removed | ~14–36s |

Not changed: image build/load (72–87s) and the smoke test (53s). Without a
paid runner there is no measured cheap lever; the load is needed so Compose can
run the exact image, and the Next.js build dominates it.

## Runs on the changed workflow (PR #264)

| Run | Cache state | Time to gate |
| --- | --- | ---: |
| 42727393085 | `node_modules` miss (first run) | 4m05s |
| 42727952652 | hit | 3m24s |
| 42728423608 | hit | 3m36s |

Sorted: 3m24s, 3m36s, 4m05s → median **3m36s** (warm-only median 3m30s) versus 4m40s before, about 1m04s faster.
The first run per branch is cold (PR caches are readable only by that PR until
main saves one; `checks` on main saves it).

## Result against target

Median is about 3.5 minutes, not quite three. The remaining blocker is the
image build and load (~72–87s) plus the smoke test (~53s), which are the
required container proof. Overlapping them with checks is already done.

## Gate and minutes

`ci-gate` is untouched and still requires `checks` and `container-smoke` to
succeed for code PRs. Smoke job time fell from ~4m11s to ~3m10s, so Actions
minutes per ticket do not increase. #254's "decide whether to optimize" item is
closed by this ticket.

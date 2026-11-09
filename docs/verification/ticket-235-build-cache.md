# Ticket #235: shared Docker and Next.js caches

## Changes

PRs import `portal-production` and never export Docker or Next.js caches.
Production imports that same scope, then exports only the `dependencies` target
with `mode=min` after a successful deployment. The runtime image has no cache
export. Exporting the dependencies target preserves `npm ci` without uploading
application source, compiled Next.js layers or runtime layers.

The Dockerfile mounts `/app/.next/cache`. `buildkit-cache-dance` (pinned v3.3.0)
restores the mount from Actions cache on both paths. Production post steps extract
it before `actions/cache` saves it, only after job success. PRs restore only.
Next.js 16.3.8 enables build filesystem caching by default; the installed
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopackFileSystemCache.md`
documents `.next/cache/turbopack`, so no configuration flag is needed.

## Real GitHub Actions evidence

Previous production build: [main run 42693473398](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42693473398).
Measurement build: [PR #247 run 42697011110](https://github.com/fjdvm/brenraphaels-authentication-microservice/actions/runs/42697011110),
commit `23ac66c`. All checks, image-size verification, container smoke test and
`ci-gate` passed. The gate completed 20:55:58 UTC on 2026-11-09.

The PR imported the existing main cache and restored its dependency layer
`sha256:fd6aaf04fd00517bc8be091f6866302186500e0285572e4c47d81e07ed8ce8f3`
(549.56 MB compressed), without executing `npm ci`. BuildKit spent 17.2 seconds
fetching/extracting the cached stage. Selected log lines:

```text
[dependencies 3/4] COPY package.json package-lock.json ./
CACHED
[dependencies 4/4] RUN npm ci --ignore-scripts --no-audit --no-fund
sha256:fd6aaf04... 549.56MB / 549.56MB
extracting sha256:fd6aaf04...
DONE 17.2s
```

| Measurement | Before | After |
| --- | --- | --- |
| GitHub cache export (BuildKit timer) | Production full-stage `mode=max`: **30.1s** | Dependency target `mode=min`, unchanged dependencies: **0.3s** |
| PR image build action | First build: **61s**, main dependencies warm, Next.js mount cold | Same tree and builder: **1s** (0.9s image export; application build `CACHED`) |

The dependency export and second image build were temporary measurement steps on
PR #247, using disposable scope `ticket235-measurement`. They are removed from the
final workflow; production alone writes `portal-production`. The 0.3s result is a
warm dependency export, not a promise for a changed lockfile or cold cache.
The new post-deploy publisher and cross-runner Next.js restoration from its first
save will run on `main` after merge; no production deployment was triggered or
awaited for this ticket.

## Local cold and warm builds

Docker Engine 29.8.0, Buildx 0.37.0, BuildKit 0.34.2, linux/amd64. A new isolated
`docker-container` builder (`ticket235-frozen`) had no imported build cache.
The checkout stayed at `23ac66c` for all three measurements. Timings are monotonic
wall-clock durations including image loading; the first includes builder startup,
base-image downloads and dependency installation. These are local measurements,
not GitHub runner duration estimates.

| Build | Command options | Seconds |
| --- | --- | --- |
| Cold | `--load -t portal:ticket235-benchmark` | **210.82** |
| Identical tree, same builder | Same options | **3.34** |
| Force application rebuild, retain dependency layers and cache mount | `--no-cache-filter build --load -t portal:ticket235-benchmark` | **44.74** |

All commands used `docker buildx build --builder ticket235-frozen --progress=plain`
with context `.`. The unchanged build reports the application build step as
`CACHED`. `docker buildx du --builder ticket235-frozen --filter type=exec.cachemount
--verbose` confirmed **101.4 MB** persisted at `/app/.next/cache`; the forced build
still compiled and typechecked, so its time is reported separately from a full
layer-cache hit.

## Repository cache usage

`gh cache list --limit 1000 --json id,key,sizeInBytes,ref` snapshots:

- Before: **10,352,079,461 bytes** across 245 entries.
- Removed 93 obsolete Docker entries belonging to confirmed closed PRs:
  **2,802,318,354 bytes** reclaimed. Main and open-PR caches were preserved.
- After cleanup and measurement: **7,549,764,397 bytes**
  across 153 entries (about 7.03 GiB, below the 10 GiB repository limit).
- The disposable measurement index was only 3,290 bytes; dependency blobs already
  existed in the shared main cache. It is removed after recording the measurement.

This is a measured repository snapshot, not a bound on future cache growth.
The workflow stops writing per-PR Docker caches and full application build layers;
Next.js snapshots remain versioned by OS, lockfile hash and commit.

## Verification

- `npx tsc --noEmit`: passed (before and after the workflow change).
- `npx vitest run scripts/ci/classify-changes.test.ts`: 27 passed.
- `npm test`: 550 passed, 23 skipped; 53 files passed and 9 skipped.
- actionlint v1.7.7 and `git diff --check`: passed.
- Standards and Spec review: no implementation defects; final evidence reviewed
  with the combined #234/#235 diff.

The parent spec names the classifier as the sole automated test seam; Docker
behavior is verified with real builds rather than mocked cache tests.

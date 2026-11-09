# Change classifier

Run `node scripts/ci/classify-changes.mjs [path ...]` with repository-relative
changed paths. It prints exactly `docs-only` or `code`, followed by a newline.
Both results exit successfully. No paths means `docs-only`.

A change is docs-only when every path is under `docs/`, ends in `.md`, is under
this repository's agent folder (`.claude/`), or is under
`.github/ISSUE_TEMPLATE/`. All other paths count as code.

For a GitHub Actions step using Bash, with `BASE_SHA` and `HEAD_SHA` set
to the diff endpoints and both commits fetched:

```bash
# NUL delimiters preserve spaces and newlines in filenames. Include deleted
# files too, so deleting code still triggers checks.
git diff --name-only --no-renames -z "$BASE_SHA" "$HEAD_SHA" > "$RUNNER_TEMP/changed-paths"
mapfile -d '' -t changed_paths < "$RUNNER_TEMP/changed-paths"
classification=$(node scripts/ci/classify-changes.mjs "${changed_paths[@]}")
echo "classification=$classification" >> "$GITHUB_OUTPUT"
```

The `changes` job in `.github/workflows/container.yml` classifies the complete PR
diff from the merge base to the PR head. It runs without installing dependencies.
Deleted paths and both sides of renames are included, so removing or moving code
into a documentation path still runs the full checks.

For docs-only PRs, `checks` and `container-smoke` are skipped. The always-running
`ci-gate` requires successful classification and verifies that both jobs were
skipped. For code PRs, it requires both jobs to succeed. A failed classifier,
unknown classification, failed check or cancelled check cannot pass the gate.

Pushes to `main` and manual runs continue to run all checks; deploy classification
is separate work under Spec#229.

## Image build caches

PR and production builds read the same Docker cache scope, `portal-production`.
PRs never export Docker cache. After a successful deploy, `main` exports only the
`dependencies` target with `mode=min`. Exporting the runtime target with `mode=min`
would exclude the intermediate `npm ci` layer; exporting it with `mode=max` would
upload the application build layers on every change.

The Dockerfile mounts `/app/.next/cache` for Next.js incremental builds. BuildKit's
GitHub cache does not persist cache mounts, so `buildkit-cache-dance` injects the
directory restored by `actions/cache`. PRs restore only. Production extracts and
saves the mount in post steps after a successful deploy. The cache key includes
the OS, lockfile hash and commit; the restore prefix reuses the latest compatible
cache when source files change. The directory and action scratch files live in
the runner's temporary directory, outside the Docker build context.

See [Docker's cache-mount guidance](https://docs.docker.com/build/ci/github-actions/cache/#cache-mounts)
and [cache modes](https://docs.docker.com/build/cache/backends/#cache-mode).

# Change classifier

Run `node scripts/ci/classify-changes.mjs [path ...]` with repository-relative
changed paths. It prints exactly `docs-only` or `code`, followed by a newline.
Both results exit successfully. No paths means `docs-only`.

A change is docs-only when every path is under `docs/`, ends in `.md`, is under
this repository's agent folder (`.claude/`), or is under
`.github/ISSUE_TEMPLATE/`. All other paths count as code.

For a future GitHub Actions step using Bash, with `BASE_SHA` and `HEAD_SHA` set
to the diff endpoints and both commits fetched:

```bash
# NUL delimiters preserve spaces and newlines in filenames. Include deleted
# files too, so deleting code still triggers checks.
git diff --name-only --no-renames -z "$BASE_SHA" "$HEAD_SHA" > "$RUNNER_TEMP/changed-paths"
mapfile -d '' -t changed_paths < "$RUNNER_TEMP/changed-paths"
classification=$(node scripts/ci/classify-changes.mjs "${changed_paths[@]}")
echo "classification=$classification" >> "$GITHUB_OUTPUT"
```

This ticket supplies the classifier only; it does not wire it into workflows.

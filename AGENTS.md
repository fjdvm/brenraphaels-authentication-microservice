<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Issue publishing

For newly published specifications, prefix each title with `Spec#<issue-number>:` using its actual GitHub issue number (for example, `Spec#17: Responsive admin sidebar`). Create the issue, obtain its assigned number, then update and verify the title. This rule applies to future specifications only; preserve existing specification titles. Read `docs/agents/issue-tracker.md` for publishing conventions and `docs/agents/triage-labels.md` for label mappings.

For newly published implementation tickets, prefix each title with `Ticket#<issue-number>:` using its actual GitHub issue number (for example, `Ticket#18: CEO authority and responsive shadcn admin navigation`). Create the issue, obtain its assigned number, then update and verify the title. This rule applies to future tickets only; preserve existing ticket titles.

## No polling

No app polls (ADR-0005, `docs/adr/0005-no-polling-anywhere.md`). Never repeat a data request on a timer, window focus or tab visibility; use the WebSocket, refetch on (re)connect, or refetch on a user action. A 30–60 second in-memory heartbeat is a keepalive, not polling. Idle-tab checks: `lib/no-polling.test.ts` and the bell's "without idle polling" browser test.

## Workflow rules

- Implement a feature only after grilling, domain modeling, a spec (`/to-spec`), and tickets (`/to-tickets`), with the spec and tickets approved by the user.
- Implement one ticket at a time against its acceptance criteria; start only after its blockers are resolved.

### Checks and PR completion

1. Before every push, run local typecheck (`npx next typegen` then `npx tsc --noEmit`) and unit tests (`npm test`). Push only when both pass.
2. Open or update the ticket's PR and enable squash auto-merge with `gh pr merge <PR> --auto --squash`. Stop when GitHub accepts auto-merge; implementation is done at that point, without waiting for merge or deployment.
3. If waiting for PR checks is unavoidable, use one blocking `gh pr checks <PR> --watch --fail-fast` command. Never loop on status commands.
4. Never wait for the production deploy. GitHub's failed-workflow notification emails the owner; Azure retains the previous revision if deployment fails.
5. Track any required live-production check in a separate verification ticket (ready-for-human or its own ticket), rather than waiting as part of implementation.

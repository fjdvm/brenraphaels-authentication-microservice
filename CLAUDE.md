@AGENTS.md

## Workflow rules

- Don't implement a feature until a spec (`/to-spec`) and tickets (`/to-tickets`) exist for it and the user has approved them. Grilling and domain modeling come first, then the spec, then the tickets.
- Implement one ticket at a time, against that ticket's acceptance criteria and its blockers. Don't start a ticket that is still blocked.

## Agent skills

### Issue tracker

Issues and specs are GitHub issues on `fjdvm/brenraphaels-authentication-microservice`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

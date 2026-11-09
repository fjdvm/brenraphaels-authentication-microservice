# Ticket 238: `main` protection

Spec #229. The `main-protection` ruleset (Settings, Rules, Rulesets) is **active** on the default branch.

| Rule | Value |
| --- | --- |
| Require a pull request | on, 0 approvals |
| Required status check | `ci-gate` (GitHub Actions) |
| Require branches to be up to date | off (`main` rebuilds from merged code) |
| Force pushes and deletion | blocked |
| Bypass | Repository admin, pull requests only |

Verify:

```sh
gh api repos/fjdvm/brenraphaels-authentication-microservice/rules/branches/main --jq '.[].type'
# deletion, non_fast_forward, pull_request, required_status_checks
```

Rollback: delete the ruleset in Settings, Rules, Rulesets.

# Gate main through PRs and rebuild on merge

Status: accepted; implementation tracked in [Spec#229](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/229) and its tickets. Recorded by [Ticket#232](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/232).

## Context

Small changes to the Portal take 15–30 minutes to reach production. The serial pipeline repeats container builds and smoke tests after merge, and documentation-only changes incur the same work. With two or three agents opening overlapping PRs, a production image must contain all merged changes, including changes absent from an individual PR's image.

This decision changes the delivery pipeline, retaining the Azure Container Apps hosting decisions in [ADR-0002](0002-move-portal-and-shared-services-to-azure-container-apps.md) and [ADR-0003](0003-move-ecommerce-and-creoms-to-azure-container-apps.md). Neon Postgres, Neon Auth and HRMS hosting remain unchanged.

## Decision

`main` accepts changes only through PRs that pass the single required `ci-gate` check. Auto-merge merges green PRs. Branch protection blocks direct pushes by agents; agents have no bypass or admin credentials. The repository owner retains admin bypass for emergencies when CI itself is broken. These repository settings are manual owner steps tracked by Spec#229; this ADR records the intended policy, not proof that rollout is complete.

For a code PR, typecheck and unit tests run in parallel with the production image build, image-size check and container smoke test against a disposable database. The always-reporting `ci-gate` passes only when all required jobs succeed. The PR and production builds use the same Dockerfile, with the public address supplied at runtime.

After merge, `main` rebuilds the production image from the merged code instead of promoting the PR's image. Typecheck and unit tests run in parallel with that build and push; deployment waits for both to pass. `main` does not re-run the container smoke test. Existing deployment health checks remain in place. PRs read the shared build cache that `main` writes, keeping the production rebuild warm.

Branch protection does not use "require up to date". Parallel agent PRs need not rebase after each other's merges. Building from merged code ensures production includes every merged change; the checks on `main` catch combinations that fail together even when their PR checks passed individually.

The change classifier runs for both PRs and `main`. Documentation-only changes skip container builds and deploys, while `ci-gate` still reports success. Mixed documentation and code changes receive the full code pipeline. Build configuration, dependencies, scripts and workflows count as code under Spec#229's classifier rules.

Rollback is a manually triggered workflow: the owner selects an earlier image reference or commit, the workflow re-points the production container app at that image and runs the deployment health checks. Rollback does not change `main` or require a new code change.

## Alternatives considered

- **Promote the PR image:** saves a production rebuild, but an overlapping PR's image can omit changes already merged into `main`. Rebuilding from merged code preserves the complete production state without requiring rebases.
- **Require branches to be up to date:** makes each PR validate the latest base, but forces parallel agents to rebase and repeat expensive checks after every merge. Checks on `main` protect deployment from incompatible combinations without this serial work.
- **Merge queue:** could validate merged combinations before landing, but is unavailable on the owner's personal-account plan.
- **Larger runners:** unavailable on the owner's personal-account plan and outside the decision to stay on free GitHub-hosted runners. Remove duplicate work and measure the result before considering paid infrastructure.
- **One shared workflow across repositories:** introduces a shared dependency and coordination before the pattern is proven. Pilot Authentication first, copy the proven pattern to ecommerce, and use it when creoms receives its container pipeline; each repository continues to own its image and workflow as in ADR-0002.

## Consequences

Code is built once for PR validation and once from merged code for production. We accept the second build to preserve all merged changes, and accept that the exact merged image is not smoke-tested: PR smoke coverage and parallel checks on `main` provide the chosen assurance. A failed typecheck or unit test on `main` blocks deployment, although the incompatible combination has already landed and needs a follow-up fix.

Documentation-only work avoids builds and deploys, making the classifier a critical boundary that must be tested. Auto-merge depends on the owner enabling it and applying branch protection; agents cannot bypass failed checks. A failed deployment keeps the previous Azure revision live, with GitHub failed-workflow notifications informing the owner; reverting a bad release uses the manual rollback workflow.

Agents run fast checks locally, open PRs with squash auto-merge and stop without waiting for production deployment. Live-production verification belongs in a separate verification ticket. Pipeline timing and Actions-minute savings must be measured after rollout; the estimates in Spec#229 are not guarantees.

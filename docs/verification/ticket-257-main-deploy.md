# Ticket #257: allow the expected skipped smoke ancestor

The deploy job now uses `!cancelled()` to override GitHub's implicit `success()`
condition, which can skip descendants of the intentionally skipped main smoke
job. It also requires successful classification, checks, production image and
ci-gate results, a code classification, and a push to main. A cancelled workflow
or failed/cancelled dependency cannot authorize deployment.

The existing gate explicitly accepts these dependency results:

| Run | changes | checks | container-smoke | production-image |
| --- | --- | --- | --- | --- |
| Code PR/manual | success | success | success | skipped |
| Code main push | success | success | skipped | success |
| Docs-only | success | skipped | skipped | skipped |

Every other combination fails. Manual runs never deploy. Docs-only runs never
build or deploy. Deployment steps and Azure configuration are unchanged.

Local verification executes the actual gate shell over 2,304 combinations of
three events, three classifications and four possible results for each of its
four dependencies. This checks the shell decision only, not GitHub scheduling.
The parent spec keeps the classifier as the sole automated test seam; live
scheduler behavior requires Actions acceptance evidence.

Live verification is tracked separately under the follow-up verification ticket
linked from #257, per AGENTS.md. It must record a real code merge's run URL and
merge-to-final-health time; prove a failing typecheck/test blocks deployment and
preserves the previous live revision; prove cancellation blocks deployment; and
record a real docs-only merge skipping image build and deploy. Update #254 and
`docs/performance/ci-pipeline-2026-11-10.md` with final-workflow timing evidence.
No production acceptance result is claimed by these local checks.

Reference: [GitHub job dependencies and conditions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).

# Portal final timings against targets — 25 October 2026

Final verification for [#93](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/93), under [#87](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/87), after #89–#92 were merged. Compared with the [23 October baseline](portal-baseline-2026-10-23.md).

All 17 flows missed the original completion target in these observations. The eight confirm-then-wait actions met the measured pending-feedback target, and delete/restore met the measured optimistic-feedback target. **No targets are relaxed.** Each completion miss has its own follow-up below; those issues do not block delivery of this report or the other performance changes. The parent performance work remains open.

## Deployment and method

- Real production Portal: `https://br-auth-three.vercel.app`; deployment `dpl_28QtNRvrMiHvdvQmwHmQZGtFKmGx`, source commit `2354c68849a22c77ba9fba59d907a9f531e72c3d`. Vercel reports `READY`, production, functions in `sin1`. This includes the region, optimistic lifecycle, display-read caching and form-feedback changes. No deployment was created or promoted for this ticket. A post-run check found that PR #123 was merged at 15:23:48 and deployment `dpl_7ttpphRxHB1mHVKo94A2nYpQMa7a` (commit `094f92f96dd8df2a80baceaaad1867ec69d3e49f`) became ready at 15:24:41, after the final timed sample at 15:22:25. That subsequent skeleton/heading change is not covered by these timings; the follow-ups record the measured deployment explicitly.
- Measured on 25 October 2026, approximately 15:12–15:22 Philippine time (UTC+8). The workspace connection reported Quezon City, Philippines, PLDT AS9299. Headless Firefox 156.0 ran on that machine without configured network throttling or browser proxy, matching the baseline's browser/version and connection location.
- The in-app browser had no available connection and the shared Playwright MCP Firefox profile was already in use. Measurements used standalone Playwright with a separate temporary Firefox profile, leaving existing browser sessions alone. Browser tooling and scripts stayed outside the committed source.
- One valid recorded sample per row, not averages, percentiles or an SLA. Elapsed time starts immediately before automation initiates the click or Enter and ends at the stated visible completion. It includes actionability/polling overhead and excludes form filling, opening confirmation dialogs and email polling. For delete/restore, the row changes optimistically; completion additionally waits for the successful Server Action response body to finish, so feedback is not mistaken for confirmation.
- An isolated Administrator browser context used ordinary browser and Next.js caches. No caches/database were deliberately flushed or warmed. The first Users-list sample is the first visit in that context; revisit returns from Access. Prefetch and notification polling remained enabled. A revisit does not prove a server cache hit; these are full UI timings including fresh authorization. Log filters use their first `Signed in` query. Loads and first queries are compared against the more generous 500 ms read target; the explicitly revisited Users list uses 100 ms. Every read also exceeds 100 ms.
- Pending feedback is measured in the browser from the captured click event to a MutationObserver seeing a disabled button with a spinner; optimistic feedback observes the changed row status. The next animation-frame callback is retained separately. These DOM/frame observations exclude automation click overhead but do not directly measure monitor paint.
- Reads used the Super Admin. Writes and password flows used only a new Staff/Employee test User, **`2026-PF-003` (Portal Final93)**, with a private disposable Mail.tm inbox. No pre-existing User's password, Role or AccessGrants was changed. Authentication used the real production origin without changing trusted domains.

## Completion comparison

Targets from #87: confirm-then-wait completion within 1 s; optimistic confirmation under 500 ms; first reads under 500 ms and cached revisits under 100 ms. The separate feedback target is under 100 ms.

| Flow | Baseline | After | Completion target | Result / follow-up | Completion observed |
| --- | ---: | ---: | ---: | --- | --- |
| Sign-in | 10.599 s | 7.562 s | 1000 ms | Miss — [#108](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/108) | Administrator greeting and all four System cards |
| Sign-out | 9.074 s | 5.011 s | 1000 ms | Miss — [#107](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/107) | Confirmed Log out to visible login form |
| Change password | 10.797 s | 4.492 s | 1000 ms | Miss — [#121](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/121) | Test User greeting and CRMS card |
| Forgot password | 3.891 s | 2.962 s | 1000 ms | Miss — [#122](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/122) | Check your email; reset email received |
| Reset password | 7.529 s (request only) | 4.985 s | 1000 ms | Miss — [#124](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/124) | Password-updated confirmation while signed out |
| System cards | 3.801 s | 1.954 s | 500 ms | Miss — [#110](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/110) | Access greeting and all four cards |
| Users list, first visit | 3.171 s | 1.947 s | 500 ms | Miss — [#109](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/109) | Heading and populated table |
| Users list, revisit | 2.209 s | 2.584 s | 100 ms | Miss — [#111](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/111) | Return from Access to populated table |
| Create User | 10.011 s | > 20.000 s | 1000 ms | Miss — [#114](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/114) | Success message and row verified after observer timeout |
| Edit AccessGrants | 13.697 s | 3.342 s | 1000 ms | Miss — [#112](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/112) | Access saved after granting Customer Profiles |
| Delete User | 7.596 s | 5.238 s | 500 ms | Miss — [#115](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/115) | Deleted row immediately; action response then completed |
| Restore User | 8.322 s | 1.892 s | 500 ms | Miss — [#116](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/116) | Awaiting first login immediately; action response then completed |
| Resend credentials | 11.234 s | 8.259 s | 1000 ms | Miss — [#113](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/113) | Credentials-emailed success message |
| System Logs, load | 5.266 s | 3.086 s | 500 ms | Miss — [#117](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/117) | Heading and populated events table |
| System Logs, filter | 4.089 s | 3.126 s | 500 ms | Miss — [#119](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/119) | Signed in search completed; 34 events |
| My Logs, load | 2.608 s | 3.799 s | 500 ms | Miss — [#118](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/118) | Activity log heading and populated table |
| My Logs, filter | 1.816 s | 1.355 s | 500 ms | Miss — [#120](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/120) | Signed in search completed; 27 events |

## Immediate feedback

| Flow | Spinner or changed row | Next animation frame | Feedback target |
| --- | ---: | ---: | --- |
| Sign-in | 5 ms | 9 ms | Met (< 100 ms) |
| Sign-out | 6 ms | 12 ms | Met (< 100 ms) |
| Change password | 9 ms | 9 ms | Met (< 100 ms) |
| Forgot password | 3 ms | 6 ms | Met (< 100 ms) |
| Reset password | 13 ms | 14 ms | Met (< 100 ms) |
| Create User | 8 ms | 13 ms | Met (< 100 ms) |
| Edit AccessGrants | 9 ms | 11 ms | Met (< 100 ms) |
| Delete User | 4 ms | 5 ms | Met (< 100 ms) |
| Restore User | 8 ms | 8 ms | Met (< 100 ms) |
| Resend credentials | 43 ms | 47 ms | Met (< 100 ms) |

Delete and restore changed the row in 4 ms and 8 ms, respectively, but their confirmation observations were 5.238 s and 1.892 s. Those follow-ups concern confirmation latency. Immediate response does not establish that the server has accepted the change. Refusal/rollback behavior remains covered by the existing view tests, rather than deliberately inducing a production authorization failure.

## Limits, retries and interpretation

- Create User exceeded the 20-second completion observer. The table records a **lower bound**, not an invented exact click-to-screen duration. The action fetch separately lasted **22.643 s** according to browser PerformanceResourceTiming; its `startTime` was 135728 ms and `responseEnd` 158371 ms. The click observer began at 135720 ms. The successful creation URL, message and new row were verified afterward, and the creation email arrived. Request duration is not substituted for visible completion.
- The baseline reset value (7.529 s) measures only its action fetch. The after value (4.985 s) measures click-to-visible confirmation in a signed-out context. Their boundaries differ; no improvement percentage or direct request-duration comparison is claimed. Signing in afterward with the new password verified the reset.
- Automation attempts with incorrect selectors were excluded. An initial sign-in observer matched the existing login heading too early and was discarded; the recorded sign-in waits for the Administrator greeting and all four cards. An initial create submission without a selected Role returned validation, was corrected and is not the successful sample. Resend ran twice because the first success-text selector was too narrow; the recorded sample is the second confirmed success, and both replacement emails arrived. The latest credentials were used for password change. Failed log-search selectors did not submit filters; the recorded samples use the visible Search field and wait for the action response, loading indicator to disappear and populated table.
- The catalog and audit history were not frozen. The Administrator saw four Systems with 10 CRMS, 6 HRMS, 7 IMS and 7 POS Modules; the initial directory had five Users (three non-Deleted). Notification requests continued in the background. The measurements do not isolate browser, authentication provider, database or audit-service costs, or establish cache freshness/hit rates.
- The Users-list revisit (2.584 s versus 2.209 s), My Logs load (3.799 s versus 2.608 s), and successful User creation (>20 s versus 10.011 s) were slower than baseline. Different dates, catalog/history, service load, cache state and automation surface prevent attributing these observations to a particular code change. Follow-ups require repeat measurements and diagnosis rather than assuming a cause.
- This report covers the 17 flows explicitly required by #87's baseline instructions. System cards means navigation inside the Portal, not a downstream System launch/handoff.

## Cleanup and migration status

The temporary Customer Profiles AccessGrant was revoked; the edit screen showed zero selected Modules before the test User was soft-deleted. A fresh Users-list reload verified Deleted status and Restore availability. Creation/resend/reset emails were received, password change completed, and the reset password was verified by a subsequent sign-in. Both measurement sessions were signed out and the disposable inbox was deleted. Test audit and grant/revoke history remain intact.

No schema or seed change is required for #93. The configured database was checked with `npx prisma migrate status`: eight migration directories, with only `20261021000000_remove_system_log` pending. The password-reset expiry migration is already applied. The pending migration drops the legacy local SystemLogEvent table and its enum without backfill; it was already pending before this ticket and is not needed for timing collection. It was left unapplied. No production migration or seed was run.

## Validation

- Installed Next.js 16.3.8 cache guide consulted; this ticket changes documentation only.
- `npx next typegen && npx tsc --noEmit`: passed in the isolated worktree.
- Full `npm test`: 50 files passed, 7 skipped; 504 tests passed, 21 skipped. Opt-in integration suites were not enabled. No new timing test was added: #87 explicitly requires real-deployment timings rather than test-runner timing assertions.
- `git diff --check`: passed.

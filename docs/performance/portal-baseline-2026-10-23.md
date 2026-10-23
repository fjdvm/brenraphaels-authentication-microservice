# Portal baseline timings — 23 October 2026

Baseline for [#88](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/88), under [#87](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/87).

Measured on the real production Portal at `https://br-auth-three.vercel.app` on 23 October 2026, approximately 20:53–21:09 Philippine time (UTC+8). No application code, caching, deployment region, or database schema was changed for this ticket. No migration was needed.

## Method

- Connection: Quezon City, Philippines; PLDT (AS9299), confirmed through the workspace's public connection geolocation. The Firefox process ran on that same machine, without a configured browser proxy or network throttling.
- Browser: Firefox 156.0 on Linux, headless, driven through Playwright MCP. The browser context was initially isolated; subsequent navigation used its ordinary browser and Next.js client caches. Neither caches nor the database were deliberately warmed or flushed.
- One recorded sample per table row. These observations are not averages or percentiles, and do not isolate server execution from network or rendering time.
- Unless specified otherwise, elapsed time starts immediately before Playwright initiates the click or Enter key and ends when the expected screen, table, status, or action becomes visible. This includes automation actionability and polling overhead. It excludes time spent filling forms, reading email, and opening a confirmation dialog. Native resend confirmation was accepted automatically.
- Feedback is the first observed pending label or disabled button after initiating the action. It includes automation overhead, so values near 100 ms do not establish whether the browser's actual click-to-spinner target passed or failed. Resend uses a browser MutationObserver from the click event instead.
- Reads used the Super Admin account. Initial User Management had three active Users. Mutations and password flows used a separate Staff/Employee test User, `2026-PB-002` (Portal Baseline88), with a test inbox supplied by the operator. No existing User's password, Role, or AccessGrants was changed.

## Required flows

| Flow | Observed pending feedback | Elapsed | Completion observed |
| --- | ---: | ---: | --- |
| Sign-in | 469 ms | 10.599 s | Administrator Access screen with all four System cards visible |
| Sign-out | 94 ms | 9.074 s | Confirm Log out to visible login form |
| Change password | 179 ms | 10.797 s | First-login password change to test User's Portal greeting |
| Forgot password | 289 ms | 3.891 s | Check your email screen; reset email received by operator |
| Reset password | Not retained | 7.529 s | Action request completed; new password subsequently verified in a fresh browser context (see below) |
| System cards | — | 3.801 s | Navigate from Users list to Access; CRMS card visible |
| Users list, first visit | — | 3.171 s | User management heading and populated table visible |
| Users list, revisit | — | 2.209 s | Return from Access; heading and table visible |
| Create User | 120 ms | 10.011 s | Redirect to Users list destination URL; new row verified immediately afterward |
| Edit AccessGrants | 124 ms | 13.697 s | Access saved message after granting Customer Profiles to the test User |
| Delete User | 90 ms | 7.596 s | After confirmation, dialog closes and row offers Restore with Deleted status |
| Restore User | 101 ms | 8.322 s | Row again offers Delete and shows Awaiting first login |
| Resend credentials | 87 ms | 11.234 s | New credentials were emailed success message |
| System Logs, load | — | 5.266 s | System logs heading and events table visible |
| System Logs, filter | — | 4.089 s | Search Signed in submitted; action response completed, loading indicator hidden, 11 event rows |
| My Logs, load | — | 2.608 s | Activity log heading and events table visible |
| My Logs, filter | — | 1.816 s | Search Signed in submitted; action response completed, loading indicator hidden, 10 event rows |

## Additional observations and limits

- An initial Administrator sign-in reached the root URL in 9.176 s, before its final cards screen was verified. The table uses the later 10.599 s measurement through visible cards instead. The test User's first sign-in to the required change-password screen took 8.892 s; a second sign-out took 9.175 s.
- Opening the edit-access dialog took 3.638 s, separately from saving it. Revoking the test Customer Profiles AccessGrant afterward took 12.309 s.
- Reset-password was submitted while an Administrator session was present in the same browser context. The successful action redirected through the login page to Administrator Access, so the expected signed-out success message was not displayed. The 7.529 s value is specifically the browser PerformanceResourceTiming duration of the reset action's fetch request, **not** click-to-visible confirmation. It ran from resource startTime 35000 ms to responseEnd 42529 ms. A separate, fresh context then signed in as the test User with the new password in 8.617 s and showed No Systems available yet, verifying both the reset and the removal of test access. Do not compare this request-only duration directly to click-to-screen measurements.
- Resend was performed twice. The first confirmed success, but its native confirmation dialog interrupted the automation's returned timing. The table records the second attempt using a DOM observer; the latest replacement credentials were used for password change.
- The catalog was not frozen: the IMS card displayed six Modules early in collection and seven later. This ticket did not change the catalog. Use these observations as an operational baseline before the performance work, not a controlled comparison over an immutable dataset. Repeat matching samples when collecting after timings.
- The System-cards sample is navigation back to Access in an existing session. Sign-in through the cards is measured separately. It does not measure a downstream System's launch or sign-in handoff.
- Every listed elapsed observation is above #87's corresponding read or write target. These samples identify the wait to investigate; they do not attribute it to a specific query, service, or region, and do not establish cache-hit performance.

## Cleanup and validation

The temporary Customer Profiles grant was revoked. After password verification, the test User was soft-deleted through the Portal, preserving its audit history and making the account restorable. The original Administrator account was left unchanged. Test emails and audit events remain as evidence of the measured operations.

Only this report is committed. Playwright MCP was configured for Firefox in the operator's user-level Codex configuration, and browser tooling and scratch artifacts were installed outside the repository.

- Typechecking: `npx tsc --noEmit` passed.
- Full current-checkout suite: `npm test -- --exclude '**/.claude/worktrees/**'` — 48 files passed, 5 skipped; 480 tests passed, 7 skipped. Disposable-database integration tests were not enabled.
- The initial unfiltered test run also discovered unrelated, pre-existing nested worktrees and failed there; it was stopped and rerun with those worktrees excluded. No test configuration was changed.

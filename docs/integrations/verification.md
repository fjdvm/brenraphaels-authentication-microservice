# Verification and outstanding work

What is verified for the integration contract and the Administrator and User journeys, where, and what is not. Written for [#28](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/28); revisit it when real Systems connect.

Run everything with `npm test`. Tests use no production identities, emails or secrets: Neon Auth, persistence and email are faked at their provider boundaries, and the database tests run only against a disposable Neon branch.

## Verified

| Area | Where | Boundary |
| --- | --- | --- |
| Simulated System: sign-in, exchange, per-request validation | `lib/integrations/lifecycle.test.ts` driving `reference/system-consumer` | Real endpoint handlers, faked ports |
| Direct entry and portal launch share one central session | `lifecycle.test.ts`, `direct-entry.test.ts` | Endpoint |
| Denied on the next request after central logout, Module revocation, User deletion; restored from retained state | `lifecycle.test.ts`, `validation.test.ts` | Endpoint |
| Outage denies and is told apart from invalid access; recovers with no stale decision | `lifecycle.test.ts`, `validation.test.ts` | Endpoint |
| Single-use code, expiry, replay, wrong System, tampered state/PKCE, unregistered callback | `handoff.test.ts` | Endpoint |
| The same lifecycle on real persistence (grant history, Restore, handle revocation) | `lifecycle.integration.test.ts`, `prisma-ports.integration.test.ts` | Disposable Neon branch: runs only when `SEED_TEST_DATABASE_URL` is set |
| Administrator navigation: desktop collapse, phone drawer, Escape and focus return; non-Administrator header logout, no sidebar | `components/layout/admin-shell.browser.test.tsx` | Component, jsdom |
| Launch cards: one per Accessible System, none for inaccessible, empty state | `components/portal/system-launch-cards.browser.test.tsx`, `lib/portal/accessible-systems.test.ts` | Component |
| User creation, Role defaults, Select all, duplicate Email | `components/admin/create-user-form.browser.test.tsx`, `lib/admin/user-provisioning.test.ts` | Component, application |
| Role and Module access edits with retained history | `components/admin/edit-user-access-form.browser.test.tsx`, `lib/admin/user-access*.test.ts`, `actions/users.test.ts` | Component, application |
| Resend credentials, delete, restore; Administrator authority re-read | `lib/admin/credential-resend.test.ts`, `user-lifecycle.test.ts`, `actions/users.resend.test.ts`, `components/admin/*-button.browser.test.tsx` | Component, application |
| System Logs: actor, action, time, outcome; no secrets; failure state | `lib/audit/system-log.test.ts`, `components/admin/system-logs-view.browser.test.tsx` | Component, application |

## What is still outstanding

- **No real System is integrated.** POS, CRMS, IMS and HRMS each still need to implement the handoff and per-request validation (see the [guide](./system-integration-guide.md)), be deployed, and be registered with their real callbacks. Only CRMS has an identified deployment; the other seeded URLs are placeholders. None of those codebases was changed or deployed here.
- **Browser coverage is component-level (jsdom).** There is no automated real-browser end-to-end suite, so phone and desktop journeys are verified per component, not as one clicked-through session on real devices and viewports. A real-browser pass remains to be done.
- **The database lifecycle test is opt-in.** It is skipped without a disposable branch, so a plain `npm test` does not exercise real persistence.
- **Email delivery** configuration is tracked in [#7](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/7) and **production login configuration and verification** in [#8](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/8); both are open. Credential emails are tested with a fake mailer, not a real provider.
- **Not supported by design:** all-devices logout, offline access or tolerating stale permissions in an outage, and OIDC compatibility.

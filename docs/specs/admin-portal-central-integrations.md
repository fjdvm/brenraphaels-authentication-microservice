# Spec: Responsive admin sidebar, System portal, User management, and central session integrations

## Problem Statement

Users can sign in centrally, but the portal only shows a welcome placeholder. Administrators have a read-only User list, no dedicated navigation, no User creation or access editor, and no System Logs. CEO currently lacks administrative authority. Other Users need a simple way to open the external Systems they can access without receiving administrative navigation.

POS, CRMS, IMS, and HRMS also need a central authentication and session authority. Opening a website through a portal link does not establish its authenticated session or enforce current Module access. Independently valid sessions or permissions captured only at login would let Users continue working after central logout or access revocation.

## Solution

Give Super Admin and CEO the same full administrative authority and a shadcn sidebar with Access, User Management, and System Logs. Use a menu-controlled drawer on phones and an expandable/collapsible sidebar on larger screens, with logout at the bottom. All other Users receive the portal without a sidebar and retain header logout.

Show one launch card per Accessible System. Rename SCMS to IMS while preserving its Modules and AccessGrants. Under User Management, provide a dedicated Add new user page collecting User information and Module selections grouped by System, with Select all per System. Provide existing Users' access settings there as well.

Retain Neon Auth for credentials and sessions. Build this portal's secure sign-in handoff and live validation endpoints so the four Systems can subsequently integrate. A System backend exchanges a single-use sign-in code and validates the original central session and current Module access on every protected request. Central logout and access revocation stop access on the next protected request; central validation outages temporarily block protected actions.

## User Stories

1. As a Super Admin, I want administrative navigation for Access, User Management, and System Logs, so that I can reach the tools I need from one place.
2. As a CEO, I want the same full administrative authority as Super Admin, so that I can administer Users, access, and audit activity.
3. As an Administrator on a phone, I want a menu button that opens and closes a sidebar drawer, so that navigation remains usable on a small screen.
4. As an Administrator on a larger screen, I want to expand or collapse the sidebar, so that I can choose how much space navigation occupies.
5. As an Administrator, I want logout at the bottom of the sidebar, so that ending my session is easy to find in either responsive layout.
6. As an Administrator using a keyboard or assistive technology, I want accessible navigation controls and drawer focus behavior, so that I can operate the administrative area.
7. As an Administrator, I want Access to show my own System launch cards, so that I can open my authorized Systems without leaving administrative navigation.
8. As a User without the Super Admin or CEO Role, I want a portal without an administrative sidebar, so that my entry point stays focused on my accessible Systems.
9. As a User without administrative authority, I want logout in the header, so that I can end my session without a sidebar.
10. As a User, I want one card per Accessible System, so that I can choose POS, CRMS, IMS, or HRMS without navigating a separate card for every Module.
11. As a User, I want a System card only when I have at least one active Module AccessGrant in it, so that the portal reflects my current access.
12. As a User, I want a System card to open the corresponding external System, so that I can start working there.
13. As a User without any Accessible Systems, I want a clear empty state, so that I understand that an Administrator must grant access before I can launch a System.
14. As a User, I want my allowed Modules to remain governed by my own AccessGrants, so that a Role template or visible System card does not give me unintended access.
15. As an Administrator, I want User Management to show Users and their current identities, Roles, and statuses, so that I can select the person I need to manage.
16. As an Administrator, I want Add new user to open a dedicated page, so that I have room to enter information and choose access.
17. As an Administrator, I want to enter a new User's first name, last name, Email, and Role, so that their identity and starting access template are defined.
18. As an Administrator, I want a Role's AccessTemplate to pre-fill Module selections while leaving every checkbox editable, so that I can tailor access for the person being created.
19. As an Administrator, I want Module checkboxes grouped by System, so that I can distinguish access to POS, CRMS, IMS, and HRMS.
20. As an Administrator, I want Select all for each System, so that I can grant its Modules without checking them individually.
21. As an Administrator, I want invalid information and duplicate Email errors to preserve my form entries, so that I can correct a creation request without starting again.
22. As a newly created User, I want a generated Username and Temporary password delivered to my Email, so that I can sign in without choosing a login identifier.
23. As a newly created User, I want to change my Temporary password before entering the portal or an external System, so that I establish my own credentials before using the suite.
24. As an Administrator, I want a User's access settings under User Management, so that I can grant or revoke individual Modules from their record.
25. As an Administrator, I want to assign Roles, issue Resend credentials, delete Users, and restore their existing records, so that full User administration remains in one area.
26. As a User whose record is restored, I want my Username, Email, and access history preserved, so that my identity is not recreated or reassigned.
27. As an Administrator, I want grant and revocation history retained, so that changing access does not erase earlier decisions.
28. As a User, I want IMS to retain the Modules and access previously associated with SCMS, so that the name change does not interrupt my work.
29. As an Administrator, I want System Logs for portal login/logout, password actions, User changes, and AccessGrant changes, so that I can review authentication and administrative activity.
30. As an Administrator, I want audit events to show actor, action, time, and outcome, so that I can understand who did what and whether it succeeded.
31. As a User, I want passwords, sign-in codes, and session secrets excluded from System Logs, so that auditing does not expose my credentials.
32. As a User without administrative authority, I want administrative pages, mutations, and logs to reject my requests, so that hidden navigation is backed by actual authorization.
33. As a demoted or Deleted Administrator, I want my administrative authority to stop on the next protected request, so that an open session cannot retain removed privileges.
34. As a User visiting an external System directly without a valid session, I want to be sent to the central login and returned to the requested System if authorized, so that I do not need a separate login there.
35. As a User already signed in centrally, I want a secure handoff to an accessible System, so that I can enter it without sharing my password or central session cookie with that System.
36. As a User without access to a requested System or Module, I want entry to be denied even through a direct link, so that portal card visibility is not the only access control.
37. As a User logging out centrally, I want that browser session to stop working across POS, CRMS, IMS, and HRMS, so that I cannot continue using the suite through a signed-out session.
38. As an Administrator revoking a Module AccessGrant, I want the User's next protected request to that Module denied, so that revocation takes effect during an existing session.
39. As the business owner, I want protected actions temporarily blocked when central validation is unavailable, so that previously checked access is not accepted during an outage.
40. As a System integrator, I want a documented sign-in exchange and validation contract with registered callbacks and backend authentication, so that I can connect each System safely in the subsequent integration phase.
41. As a System integrator, I want expired, reused, mismatched, or unauthorized sign-in exchanges rejected, so that a code issued for one sign-in cannot establish an unrelated session.
42. As a developer publishing a specification, I want its GitHub issue title to start with Spec:, so that published specifications are identifiable in the tracker.

## Implementation Decisions

- **Administrative authority:** Super Admin and CEO are the only administrative Roles and have equal authority. Admin names the existing Super Admin Role; it is not a new Role. Re-read current User eligibility and Role on every protected administrative request. Administrative authority does not automatically create Module AccessGrants.
- **Responsive navigation:** use the shadcn sidebar component and its accessible responsive primitives. Include Access, User Management, and System Logs, an active destination indicator, a menu/collapse control, and bottom logout. Non-Administrators retain header logout and receive no sidebar. Preserve existing branding.
- **Portal cards:** derive Accessible Systems from active AccessGrants, not Role names or AccessTemplates. Render one card per Accessible System, using its configured destination. A card grants no additional Module authority. Reflect revoked access when portal data is next loaded and present a useful empty state when none remains.
- **IMS rename:** migrate SCMS to IMS without deleting/recreating its System, Modules, or grant history. Update reference data and visible System naming; repeated seeding must not create a duplicate legacy System or reset access. Preserve existing Role assignments.
- **User Management:** extend the current read-only listing into full User administration. Add a dedicated creation page and existing-User access editing. Preserve the existing User identity rules, status derivation, mandatory password change, and Deleted User/Restore semantics from the domain glossary.
- **Creation:** collect first name, last name, case-insensitively unique Email, and Role. Generate the permanent Username using the existing annual sequence. Apply the chosen Role's AccessTemplate once as editable defaults; grant the final checked Modules individually. Select all is a convenience for selecting Modules in a System, not a stored System-level grant.
- **Credentials:** create the linked Neon Auth identity and portal User, issue a Temporary password, and email it with the generated Username. Do not display the Temporary password to the Administrator. Creation and Resend credentials leave the User Awaiting first login. Keep public self-registration disabled. Surface provisioning and delivery failures truthfully and avoid duplicate identities or active grants when a request is retried.
- **Existing User actions:** support Role assignment, Module grant/revocation, Resend credentials, Delete, and Restore under User Management. Role/template changes do not overwrite existing AccessGrants. Revocation retains history; Restore retains identity, password state, and AccessGrants for Administrator review.
- **Audit data:** add persistent System Logs for this portal's authentication and administrative events. Store actor identity where known, action, relevant target, timestamp, and outcome. Record successful changes only after their outcomes are established and distinguish failures. Never store passwords, session cookies, codes, tokens, or other credentials in event data.
- **Provider boundary:** Neon Auth continues owning credentials and sessions; this portal owns User eligibility, administrative authority, Module access, and the external integration contract. Do not replace the existing login provider or introduce an independently authoritative session in an external System.
- **Sign-in handoff:** provide an authenticated browser authorization entry point that checks current User eligibility and requested System access, then issues a short-lived, single-use code bound to the registered System, exact callback, original central session, and request correlation. Unauthenticated Users sign in centrally; Awaiting first login Users must change their password before a handoff can complete. Preserve the authorized return request across those steps.
- **Backend exchange:** provide an authenticated server-to-server code exchange returning an opaque integration session handle bound to the System and original central session. Consume codes atomically, reject expired/replayed/wrong-System exchanges, validate request correlation, and protect the handoff against interception using a proof-of-possession mechanism such as PKCE. Central session cookies remain private to the portal; exchange and validation credentials remain private to System backends.
- **Live validation:** provide an authenticated server-to-server validation endpoint for the System-bound handle and requested Module. Return the current session eligibility and access decision needed to allow or deny that protected request. Reject mismatched Systems/Modules, Deleted or missing Users, mandatory password-change states, revoked/expired sessions, and absent/revoked AccessGrants. Distinguish invalid access from unavailable validation so consumers can show an appropriate error while denying both.
- **Freshness:** bypass the installed auth SDK's local session cache when validating current sessions. Reading current portal User/Role data alone does not prove a cached Neon session remains active. Token signature validation or a login-time permissions snapshot alone does not satisfy this contract.
- **Logout and revocation:** central logout must revoke the original central session and make associated integration handles unusable on the next protected request. Module revocation denies the next protected request to that Module without requiring a new login. The agreed logout scope is the same browser session; a new global all-device logout feature is not part of this change.
- **Availability:** central validation outages cause Systems to temporarily block protected actions. Consumers must not accept previously checked permissions or extend an independently valid session during the outage.
- **Registration and persistence:** extend persistence as needed for registered Systems/callbacks/backend credential verification, expiring single-use handoff codes, System-bound session handles, and audit events. Preserve existing identity and AccessGrant uniqueness/history constraints. Store integration secrets and bearer handles with appropriate protection, and document required configuration without committing real secrets.
- **Configuration:** register each System's actual destination and approved callbacks explicitly. Current placeholder deployment URLs must not be represented as tested integrations or automatically trusted callbacks. Reject arbitrary return URLs and callback destinations.
- **Contract documentation:** describe authorization, code exchange, validation, request authentication, errors, expiration, callback registration, logout/revocation, outage behavior, and an example consumer flow. The endpoint contract may be tested with a simulated System backend; modifying the four external codebases is a subsequent phase.
- **Specification publishing:** published specification issue titles must start with Spec:. Apply the ready-for-agent triage label to this specification.

## Testing Decisions

- Test externally observable behavior: visible navigation, redirects, successful/denied requests, persisted identities/access history, audit outcomes, and the published integration contract. Avoid assertions about component internals, private helper calls, or the exact organization of persistence operations.
- Prefer the highest existing application boundaries. Use browser journeys for responsive navigation, access cards, User creation/access management, and log visibility. Use endpoint-level scenarios for authorization, code exchange, live validation, logout, and revocation. Avoid adding separate testing seams for each helper.
- Reuse existing auth Server Action and session-guard testing patterns for identity errors, mandatory password change, deletion, demotion, and credential actions. Reuse existing User status, Username generation/sequence, and idempotent seed coverage rather than duplicating it.
- Browser journeys cover Super Admin and CEO at phone and desktop sizes; drawer open/close, desktop collapse/expand, keyboard operation, bottom logout, navigation destinations, and non-Administrator header logout without a sidebar.
- Browser and application-boundary scenarios cover one card per Accessible System, no inaccessible cards, empty access, form validation, Role template defaults, individual selections and Select all, creation with generated Username and emailed credentials, and editing grants with preserved history.
- Authorization scenarios drive direct administrative URLs and mutations as unauthenticated, non-Administrator, Deleted, demoted, and Awaiting first login Users; hiding a sidebar is not sufficient proof of enforcement.
- Integration scenarios use a simulated System backend and an isolated test database. Fake Neon and email only at their external provider boundaries where needed; test real persistence and single-use code consumption, including concurrent replay, without using production identities or sending real credential emails.
- Endpoint tests cover valid handoff, direct-entry login/return, password-change completion, unregistered callbacks, tampered correlation, wrong-System credentials/handles, expired or replayed codes, unauthorized Modules, deleted Users, and expired sessions.
- Lifecycle tests establish a valid integration handle, then centrally log out or revoke a Module. The very next validation request must deny the affected session/access, including when local session cache data or a previously issued signed token still exists. A still-authorized Module is not revoked merely because another Module was revoked.
- Outage tests make the session provider or central access lookup unavailable and assert no positive access decision is returned. Consumer documentation and the simulated backend must demonstrate denial rather than stale-access fallback.
- Audit scenarios verify actor/action/time/outcome for supported authentication and administrative events, distinguish success/failure, reject non-Administrator log access, and assert that sensitive credential values are absent.
- Migration/seed integration coverage preserves SCMS identity and existing Module/grant history during the IMS rename, re-runs safely, preserves User Roles, and leaves no duplicate SCMS/IMS System. Follow the existing disposable Neon branch pattern for database integration checks.
- This is a testing plan for future implementation, not a claim that these new checks already exist or pass. The User approved the browser-journey and endpoint-level testing boundaries during spec synthesis.

## Out of Scope

- Implementing or deploying consumer changes inside POS, CRMS, IMS, or HRMS. The portal endpoints alone do not make those Systems integrated; each must subsequently implement the handoff and per-request validation contract.
- Operational log collection from the four external Systems, a centralized observability platform, or a new audit retention/deletion policy.
- Replacing Neon Auth, deploying another identity provider, or claiming the custom integration contract is a complete OIDC provider.
- Independent per-System credentials or sessions that remain authoritative after central logout; offline access or accepting stale permissions during central validation outages.
- System-level grants that bypass the per-Module AccessGrant model, automatic ongoing Role-based Module authorization, or retroactively applying AccessTemplate changes to existing Users.
- Recreating SCMS data as a separate IMS System, changing the retained Module feature boundary, or reassigning existing Usernames/Emails.
- New MFA/social sign-in, self-registration, an all-device logout feature, or changes to existing password policy beyond what the agreed flows require.
- Publishing implementation tickets, application implementation, production database migrations, or production deployment as part of this spec-publishing task.

## Further Notes

- This extends the initial login/read-only admin scope in #1 and the users-list ticket in #6. Equal CEO authority and IMS naming supersede those older specifications' Super-Admin-only administration and SCMS naming for this feature. Do not rewrite unrelated earlier issue history.
- The confirmed interview decisions are captured in the project domain glossary, design notes, and central-session architectural decision. Use their domain vocabulary consistently during implementation.
- The installed auth SDK has a local session cache and does not expose a hosted OIDC-provider configuration through the current server setup. Implementers must verify the supported fresh-session API and its installed-version behavior rather than assume a convenience get-session call performs uncached validation.
- Only CRMS has a deployment URL identified as deployed in the current reference data; the other seeded destinations are placeholders. Real deployment/callback registration is part of connecting each System later.
- Existing credential delivery configuration has separately tracked work in #7, and production login configuration/verification is tracked in #8. Integration and User creation must report missing provider configuration rather than claim successful delivery or production readiness.
- The ready-for-agent label applies to this spec. Feature implementation still follows the repository workflow requiring approved spec and implementation tickets, handled separately.

# Administrative navigation and portal design

Status: design decisions synthesized into [Spec #17](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/17). Implementation awaits approved spec and implementation tickets under the repository workflow.

## Confirmed decisions

- Super Admin and CEO have the same full administrative authority, including User management, access management, and System Logs. Admin refers to the existing Super Admin Role, not a new Role.
- Administrators have a mobile-first responsive sidebar containing Access, User Management, and System Logs, with logout at the bottom.
- On phones, a menu button opens and closes a sidebar drawer. On larger screens, the sidebar is persistent when expanded and can also be collapsed; logout stays pinned at the bottom of the expanded sidebar or drawer.
- Use the shadcn sidebar component for administrative navigation.
- All other Users have a portal with access cards and no sidebar; their logout remains in the header.
- The Access tab shows the signed-in Administrator's launch cards. Other Users' access settings belong in User Management.
- User Management provides an Add new user action that navigates to a dedicated page for the User's information and selection of the external Systems they can access.
- The creation page presents Module checkboxes grouped by System, with a Select all option for each System. Access remains per Module; Select all grants each Module in the selected System.
- IMS is a rename of SCMS, retaining its existing Modules and AccessGrants.
- The portal is intended to be the central authentication and session authority for POS, CRMS, IMS, and HRMS. Cards navigate to those external Systems.
- The portal shows one card per Accessible System, derived from at least one active Module AccessGrant. Each card opens that external System; access to its individual Modules remains governed by the User's AccessGrants.
- System Logs cover this portal's authentication and administrative activity: login/logout, password actions, User changes, and access grants/revocations, with actor, action, time, and outcome. Operational events from the four external Systems are outside this initial scope.
- Central logout ends the same browser session across POS, CRMS, IMS, and HRMS. An external System must not continue accepting that session after central logout.
- Revoking a User's Module access takes effect on the next protected request to that Module, including during an active session; enforcement does not wait for logout or another login.
- This implementation phase covers the portal UI and central integration endpoints. Connecting POS, CRMS, IMS, and HRMS is a subsequent phase; cross-System logout and access revocation require those integrations.
- Opening an external System directly without a valid session sends the User to this portal's login and then returns them to the requested System if they have access.
- If central session or access validation is unavailable, external Systems temporarily block protected actions rather than continue accepting previously checked access.
- Keep Neon Auth as the credentials and session provider. This portal provides a secure sign-in handoff using single-use codes exchanged by each System's backend and live central session/Module access checks on every protected request.

## Integration implementation requirements

- Bind sign-in codes to a registered System and callback, consume them once, and keep central session cookies private to the portal.
- Validate the underlying session without accepting the SDK's local session cache as evidence that a revoked session is still active.
- Check current User eligibility and Module AccessGrants during central validation.
- Document the contract and provide a way to register each System's actual deployment and callback URLs for the subsequent integration phase.

See [CONTEXT.md](../../CONTEXT.md) for domain terminology.

## Published implementation tickets

The approved tickets were published with their original sequential title prefixes; future tickets use actual GitHub issue numbers as required by AGENTS.md.

| Ticket | GitHub issue | Blocked by |
| --- | --- | --- |
| CEO authority and responsive shadcn admin navigation | [#18](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/18) | None |
| System launch cards and history-preserving IMS rename | [#19](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/19) | #18 |
| System Logs for portal authentication activity | [#20](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/20) | #18 |
| Create a User with Module selections and emailed credentials | [#21](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/21) | #19, #20 |
| Edit existing User Module access and Role | [#22](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/22) | #21 |
| Resend credentials from User Management | [#23](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/23) | #21 |
| Delete and restore Users without losing identity or access history | [#24](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/24) | #21 |
| Secure sign-in handoff to a registered System | [#25](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/25) | #19 |
| Live session and Module validation with immediate logout and revocation | [#26](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/26) | #25 |
| Direct System entry through central login and password-change return | [#27](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/27) | #25 |
| Runnable System integration reference and complete lifecycle verification | [#28](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/28) | #22, #23, #24, #26, #27 |

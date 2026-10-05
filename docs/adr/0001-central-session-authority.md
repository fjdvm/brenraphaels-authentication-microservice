# Central session authority across the four Systems

Status: accepted design; implementation pending.

The portal is the authentication and session authority for POS, CRMS, IMS, and HRMS. Logging out centrally ends the same browser session across all four Systems, rather than letting each System retain an independently valid session, so a signed-out User cannot continue using an external System through that session. Each integration must enforce this lifecycle; a portal card redirect alone does not establish or revoke an external System's session.

Module access is also centrally authoritative: revoking an AccessGrant must block the User's next protected request to that Module, even within an existing session. Integrations cannot rely on a permission snapshot taken only at login.

If central validation is unavailable, Systems block protected actions until validation works again. This chooses enforcement of current sessions and access over continued operation with previously checked access during an outage.

Keep Neon Auth as the credentials and session provider. This portal supplies the cross-System contract: a single-use sign-in code exchanged by a System's backend, followed by live central session and Module access validation on every protected request. This preserves the existing provider while enforcing centrally current access; independently validating signed identity tokens alone would not satisfy immediate logout and access revocation.

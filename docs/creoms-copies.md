# CREOMS Portal copies

Dependency for fjdvm/epic-crms#249. No database migration or new secrets.

`POST /api/integrations/recipients` uses the existing System backend Basic
credentials. It returns `{ staff: [{ id, modules: ["Orders", "Payments"] }] }`
for the authenticated System only. IDs are Portal User ids (the same ids used by
the Portal inbox), not usernames or Neon Auth ids. Modules come only from active
AccessGrants; Role templates and administrator status do not implicitly grant
access. Deleted Users and Users still using Temporary passwords are excluded.
No browser session is required, and the response is never cached. Invalid
credentials return 401; database errors return 503.

The Portal bell preserves `sendingApp` from notifications and badges copies whose
sender is `CREOMS`. Clicking a copy uses the existing mark-read call before
opening its absolute CREOMS Order URL. CREOMS reconciles that read with its shared
feed and other copies on the next sync. Revoking a Module does not remove inbox
rows; current CREOMS page authorization still applies when a link is opened.

# Role authority is enforced on the server

Status: accepted; implementation tracked in the spec for Admin and CEO access.

The Portal's admin screens have two levels of access. The Admin Role has Full access and the CEO Role has View access (see `GLOSSARY.md`). Every write path, whether a server action or an API route, checks the signed-in User's Role and refuses a CEO with 403, independent of what the page rendered. The screens also omit write controls for a CEO, but that is a mirror of the rule, never the rule itself.

## Alternatives considered

Hiding buttons only is simplest, but a hand-built request would still succeed. Disabling the controls instead of removing them leaves a CEO looking at actions they cannot take, which contradicts the Figma design. Using one `requireAdministrator()` check for both reading and writing is what the code did when the CEO had the same authority as the Admin, and it cannot express View access.

## Consequences

Reading an admin page requires an Admin or CEO. Writing requires an Admin. Each write path calls the same guard so a new write path cannot ship without a role check, and a test asserts that a CEO is refused on every write. Settings that CREOMS owns (Approval limit, COD amount, service levels) keep their own Admin-only check in CREOMS as well, since the Portal is not the only caller.

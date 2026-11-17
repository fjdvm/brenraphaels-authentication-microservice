# brenraphaels-authentication

Central identity and access-control portal: it decides which of the four business Systems — and which Module within each — a User may open, and lets an Administrator manage that on a per-User basis.

## Language

### Systems & Modules

**Portal**:
The signed-in entry point where a User opens external Systems through one card per Accessible System.

**System**:
One of the four external applications (CRMS, HRMS, POS, IMS) this portal grants Users access into and redirects them to.
_Avoid_: App, Application, Service.

**IMS**:
The System formerly called SCMS, covering suppliers, procurement, inventory, production, and distribution. The name change preserves its existing Modules and Users' AccessGrants.
_Avoid_: SCMS (former name).

**Module**:
A distinct feature area within a System (e.g. Payroll & ESS, Customer Profiles). The smallest unit access is granted or revoked at — there is no coarser "grant the whole System" action.
_Avoid_: Feature, Page, Screen, Permission.

### Roles, Users & Access

**Role**:
A named template (e.g. "CRMS Manager", "Cashier") used to pre-fill an AccessTemplate when an Administrator creates a User; the Admin Role confers Full access to the Portal's admin screens and the CEO Role confers View access to them. A Role never determines Module access — only that User's own AccessGrants decide that.
_Avoid_: Permission group, Access level, Group.

**AccessTemplate**:
The set of Modules a given Role pre-checks for a newly created User, read once at User-creation time and never again. Purely a starting point for the Administrator's checkbox matrix — every checkbox stays individually editable, and changing a Role's AccessTemplate later has no effect on Users already created from it.
_Avoid_: Default permissions, Role permissions, RoleModuleAccess.

**Administrator**:
A User with the Admin Role, with Full access to every admin screen: managing Users and their AccessGrants, Account requests, the shop Settings, and System Logs. No other Role is an Administrator.
_Avoid_: Super Admin (former name of Admin).

**Admin**:
The Role that runs the Portal and holds Full access to every admin screen. The first Admin is bootstrapped directly because no Administrator yet exists to create them. Formerly called Super Admin; renaming preserves its Users. An Admin User cannot be deleted.

**CEO**:
The owner's Role. It sees every admin screen with View access and can change nothing in the Portal. It is not an Administrator.

**Full access**:
The ability to see and use every control on a screen, including every button that creates, changes, deletes or sends something.

**View access**:
The ability to read a screen and nothing else: every control that creates, changes, deletes or sends something is absent, not disabled. Searching, filtering, paging, opening an item to read it, the notification bell and Log out remain. Refused for writes on the server as well as hidden.
_Avoid_: Read-only mode, disabled controls.

**General Manager**:
A non-administrative Role for the person overseeing the whole business. Its AccessTemplate pre-checks every Module in every System, but it confers no access to the admin screens; only an Administrator can assign it.
_Avoid_: GM, Admin.

**System Logs**:
The audit history of this portal's authentication and administrative activity, including login/logout, password actions, User changes, and AccessGrant changes. Each event records who acted, what happened, when, and the outcome. Held only in the audit-logs service (the Portal writes as its Authentication Source and keeps no local copy).

**User**:
A named individual with a login to this portal, created by an Administrator and identified by a system-generated Username rather than one they choose themselves. Every User has an Email. Users sign in with their Username and password and never type their Email to log in; the Email is where credentials and password-reset links are delivered.
_Avoid_: Account, Employee.

**Username**:
A User's login identifier, generated once at creation as YYYY-XX-NNN — the year created, that User's initials, and a running count shared across every User created that year (not reset per set of initials). Fixed for life, even across a Deleted User / restore cycle. The bootstrapped first Super Admin follows the same shape with ADMIN in place of initials: 2026-ADMIN-001. It takes the first count of 2026, so the next User created that year is 002.

**Email**:
The address a User's credentials and password-reset links are sent to. Chosen by the Administrator at creation, unique across all Users, and treated case-insensitively.

**Temporary password**:
The single-use password an Administrator's action generates for a User and emails to them together with their Username, valid only to sign in once and set a real password. It is never displayed to the Administrator and never becomes permanent: every time one is issued, the User must change it at their next login.
_Avoid_: Initial password, default password, reset password.

**Awaiting first login**:
The status of a User who holds a Temporary password they have not yet replaced. A User is Active, Awaiting first login, or Deleted — never more than one. A User in this status is sent to change their password straight after signing in and can reach nothing else until they have; once they have, they land on the portal like any other User.

**Resend credentials**:
An Administrator issuing a User a fresh Temporary password and emailing it, replacing whatever password they had. Works for any existing, non-Deleted User, and always leaves them Awaiting first login — including a previously Active User.
_Avoid_: Reset password, forgot password (that is the User-initiated flow below).

**Forgot password**:
The User-initiated way to regain access: from the login page a User asks for a reset, and a time-limited link is emailed to their Email, through which they set a new password themselves. Distinct from Resend credentials, where an Administrator issues the new password. Completing it leaves the User Active, not Awaiting first login.
_Avoid_: Resend credentials, Temporary password.

**Deleted User**:
A User an Administrator has removed, but who is retained rather than erased: unable to log in, while their Username, Email, and full AccessGrant history stay intact for audit purposes. If the same person needs the portal again, their existing User is restored — a Username or Email is never reissued to a different person.
_Avoid_: Deactivated user, disabled user, removed user.

**AccessGrant**:
The one fact that actually determines whether a User can reach a given Module right now — independent of their Role or any AccessTemplate, which only ever mattered at creation time. Checking a Module for a User creates an AccessGrant; unchecking it revokes that AccessGrant without erasing it, so a User's full grant/revoke history for a Module survives even after it's later re-granted.
_Avoid_: Permission, UserModuleAccess, Access record.

**Accessible System**:
A System in which a non-Deleted User currently holds at least one active AccessGrant on any of its Modules. Derived from AccessGrants, never granted or stored itself — there is no coarser "grant the whole System" action.
_Avoid_: Granted System, System access

**Restore**:
Bringing a Deleted User back as the same User — same Username, Email, and AccessGrant history — rather than creating a new one. It changes nothing else: their password and AccessGrants come back exactly as they were, so an Administrator should review both afterwards.
_Avoid_: Undelete, reactivate, re-create.

### Shop settings

**Approval limit**:
The peso amount above which a refund or write-off also needs the CEO's final approval; an amount equal to the limit stops at the Manager. Owned by CREOMS and changed only by an Admin. A request keeps the limit that applied when it was sent.

**Payment account**:
One place customers send money: a GCash number, a Maya number or a bank account, each with an account name and an optional QR code. An Admin can add any number of them and deactivate one but never delete it. The store gives each order one active account per method and the order keeps it, so older orders keep showing the account they were given.
_Avoid_: Payment method (that is GCash, Maya, Bank transfer or Cash on Delivery itself), payment details.

**Automatic check**:
A plain rule, with no AI, that raises a flag for staff when it hits; it never cancels or rejects on its own. Each can be switched off and its numbers edited by an Admin, except the duplicate Senior/PWD ID check, which blocks and is always on.
_Avoid_: Fraud rule, validation.

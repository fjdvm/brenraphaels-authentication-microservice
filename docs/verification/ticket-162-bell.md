# Ticket #162: live Portal bell

The browser POSTs to `/api/notifications/live`; the Portal validates its current
session and local User before requesting a 60-second Live ticket from the gateway
with its server-only Caller key. Request bodies and query parameters cannot choose
a User. The gateway scopes the pass to its configured Caller App and User and
rejects a conflicting declared User. The Caller App must match `NOTIFICATIONS_APP`
(default `Portal`), as for existing notification REST reads.

The browser connects to the gateway's `/notifications/live` WebSocket. Connect and
`notification.created` / `notifications.read` events trigger authoritative inbox
reads. There is no interval, visibility polling, or periodic HTTP heartbeat.
Reconnect obtains a new pass, uses exponential backoff with jitter (1–37.5 seconds
maximum including jitter), and reads the current inbox after subscribing. Cleanup
closes the socket and cancels retry timers. A 401/403 stops ticket retries.

## Verification

`bash scripts/container-smoke/run.sh` runs the production Portal image with a
throwaway migrated PostgreSQL database, Neon-compatible transport, and external
Auth and gateway/notifications fixtures. Chromium checks live delivery, no HTTP
requests over 6.5 idle seconds, another User's notification not arriving, refusing
a conflicting User on upgrade, and automatic reconnect/catch-up after a service
outage. CI installs Chromium and runs this check on pull requests and main pushes.
The fixture models the existing gateway wire contract; it does not test deployment
DNS, Azure ingress, or the gateway's cryptographic implementation.

The old polling image fails this test with `bell must open a WebSocket` (0 vs 1).
No production database migration, data backfill, or new secret is required.

## Standards

Reviewed against `41af41f2c0adc2e996b88f2736770aaf408ea0ec` (main at
implementation start), repository guidance, the session-authority ADR and the
installed Next.js route-handler guide. No documented-standard violations or
baseline smell findings. The review caught a Playwright APIResponse method error;
fixed to use `headers()` and re-reviewed successfully.

## Spec

Reviewed against Ticket #162 and parent Spec #138. No production behavior defects
or scope creep found. The review requested checking WebSocket frames, rather than
only the rendered page, for recipient isolation. The check now confirms receipt of
the signed-in User's frame and absence of the other User's frame; re-review passed.

Review summary: Standards 0 remaining findings; Spec 0 remaining findings.

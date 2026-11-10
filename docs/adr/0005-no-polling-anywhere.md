# No app polls

Status: accepted. Recorded by [Ticket#179](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/179) under [Spec#172](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/172).

## Context

Bells and live screens used to stay fresh by asking the server on a timer. Idle open tabs kept servers busy, cost compute on the Azure credit and still showed stale data between ticks. Spec#172 moved the Portal, CREOMS, HRMS and Smart Inventory to a WebSocket against the notifications service (see [ADR-0002](0002-move-portal-and-shared-services-to-azure-container-apps.md)).

## Decision

No app polls: Portal, ecommerce, CREOMS, HRMS, Smart Inventory and POS. A client never repeats a data request on a timer, on window focus or on tab visibility. Fresh data arrives one of three ways:

- a WebSocket message from the notifications service;
- a full refetch of current state on every (re)connect, with exponential backoff and jitter between attempts;
- a refetch on a user action, such as opening the bell or pressing a refresh control.

A heartbeat is not polling. A 30–60 second ping that the notifications service answers in memory, with no database or API call, only detects silently dead connections. It carries no data and triggers a refetch only through the reconnect path.

Timers that never touch the network are not polling either, for example a countdown or a clock that re-renders local state.

## Consequences

- A new feature that needs live data uses the Live ticket flow; it does not add a timer.
- Each app's agent notes (`AGENTS.md`) state this rule, and each app has an idle-tab check that fails if a periodic request appears.
- Reviewers reject `setInterval`, `refetchInterval`, `refetchOnWindowFocus` and `revalidateOnFocus` used for data.

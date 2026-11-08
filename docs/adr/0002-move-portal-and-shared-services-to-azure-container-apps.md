# Move the Portal and shared services to Azure Container Apps

Status: accepted; implementation tracked in [Spec#138](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/138) and its tickets. Recorded by [Ticket#140](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/140).

The Portal's Vercel Hobby team is paused until 2026-12-06. The owner has about $80 of Azure credit, subject to subscription verification, and a monthly budget below $20. Move the Portal, audit-logs, file-storage, api-gateway and notifications from Vercel and Cloudflare Workers to Azure Container Apps, together in one resource group and Container Apps Environment in Indonesia Central (Jakarta). This consolidates the shared infrastructure while retaining a runtime that supports persistent WebSockets.

This decision supersedes the gateway's [ADR-0001](https://github.com/fjdvm/brenraphaels-proxy/blob/main/docs/adr/0001-gateway-runs-on-cloudflare-workers.md) and the hosting decision in notifications' [ADR-0001](https://github.com/fjdvm/brenraphaels-notifications/blob/main/docs/adr/0001-deploy-entirely-on-cloudflare.md). The Portal has no previous Cloudflare hosting ADR. The gateway records the same hosting decision in its own ADR-0002; notifications records its replacement runtime decision in ADR-0005.

## Alternatives considered

Keep the current split across Vercel, Cloudflare and Azure: this avoids rewriting the Workers integrations but leaves three hosts to operate and does not consolidate the shared services within the Azure credit. Waiting for the Vercel pause to end leaves the Portal unavailable in the meantime. Moving everything shared to Vercel would also require another solution for persistent WebSockets. Keeping the shared runtime entirely on Cloudflare retains Durable Objects and Queues but does not use the available Azure credit or satisfy the chosen consolidation.

## Consequences

We accept the cost of replacing notifications' Durable Objects and Queues with in-memory WebSocket rooms and timer-based Email retries in a single Node service, and replacing the gateway's Workers rate limiter and service binding with an in-memory per-Caller limiter and HTTPS calls. Notifications cannot scale out without shared coordination such as Azure Web PubSub or Redis. Restart and retry behavior is recorded in notifications' ADR-0005.

Each repository will own its container image and deployment workflow. Stable service subdomains allow callers to change addresses without changing credentials. Neon Postgres and Neon Auth remain unchanged, and ecommerce, hrms and creoms stay on Vercel; this is not a data migration. Cutover is staged, keeping the old deployments available for rollback until a quiet week has passed, and accepts one forced sign-out when the Portal moves.

Azure credit is finite, and the below-$20 budget is a constraint rather than a verified cost guarantee. Subscription credit and pricing must be verified, with budget alerts and cost monitoring. Replica counts and sizing are tuning settings maintained in Spec#138, not architectural decisions in this ADR.

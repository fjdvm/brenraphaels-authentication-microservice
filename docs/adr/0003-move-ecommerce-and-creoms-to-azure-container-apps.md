# Move ecommerce and creoms to Azure Container Apps

Status: accepted; implementation tracked in [Spec#180](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/180). Recorded by [Ticket#183](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/183).

Move ecommerce and creoms to Azure Container Apps alongside the Portal and shared services. This supersedes only the statement that ecommerce and creoms stay on Vercel in [ADR-0002](0002-move-portal-and-shared-services-to-azure-container-apps.md). HRMS stays on Vercel in the owner's second account under [Spec#222](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/222), which supersedes Spec#208's plan to move HRMS to Azure; that part of ADR-0002 remains true.

The existing Vercel Hobby team is paused, and every old host returns HTTP 402. The owner's other Vercel account is also Hobby, with the same Active CPU pause risk and non-commercial-only restriction. For ecommerce and creoms, use Azure for the roughly two-month demo with a monthly budget of $25 to $30. This budget is a constraint, not a verified cost guarantee; usage and cost need monitoring.

## Alternatives considered

Waiting for the Vercel pause to end leaves the apps unavailable during the demo. Moving ecommerce and creoms to the other Hobby account retains the same limits and restrictions, so it is not the chosen home for these apps. HRMS separately accepts that risk under Spec#222. Rebuilding each Vercel service as an Azure equivalent adds infrastructure and operational work beyond this short demo's needs.

## Consequences

Replace BotID with Cloudflare Turnstile plus a per-IP rate limit on sign-up, forgot-password and email-verification actions. Remove Vercel Queue and the outbound delivery of submitted and withdrawn careers applications: HRMS reads applications from the shared database, and nothing calls HRMS to deliver them. Replace ecommerce and creoms Vercel Cron jobs with GitHub Actions schedules; HRMS retains its Vercel Cron job under Spec#222.

New payment-proof uploads move from Vercel Blob to file-storage through the gateway as private Files with signed view addresses. Existing Blob files stay in place and use the legacy read path; they may remain unreadable while the paused team blocks Blob, which is accepted. No existing Blob files are copied.

All Customers are signed out once at ecommerce cutover, and old verification and password-reset email links stop working. The new addresses and callbacks must be configured before cutover. Neon Postgres and Neon Auth remain unchanged; this hosting decision requires no database migration. The roughly two-month demo horizon bounds this decision; a permanent setup requires a fresh review of costs and the removed delivery retries.

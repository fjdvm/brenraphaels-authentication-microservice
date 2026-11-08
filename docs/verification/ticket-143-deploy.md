# Portal delivery to Azure Container Apps

Ticket: #143; parent: #138. No database migration is needed.

Every push to main runs the existing container smoke suite before publishing a
production image to ghcr.io/fjdvm/brenraphaels-authentication-microservice using
GITHUB_TOKEN. The public URL build argument and matching runtime environment value are
https://portal.buildwrite.me (email code also reads it dynamically).
Azure login uses the OIDC secrets from #141. Deployment uses the immutable image
digest. PRs and manual smoke runs cannot deploy.

The portal app runs in rg-brenraphaels / cae-brenraphaels, Indonesia Central,
with 0.5 vCPU, 1 GiB and min 1 / max 2 replicas. Startup, readiness and liveness
probes check /api/health on port 3000. The workflow waits for the exact revision
to become Healthy and latest-ready, checks public health, and prints its default
HTTPS address and revision in the Actions summary.

## Configuration

GitHub secrets must include every key in .env.production.example except
NEXT_PUBLIC_APP_URL, plus GHCR_PULL_TOKEN and the three AZURE_* OIDC identifiers.
Set repository variable GHCR_USERNAME to the pull token owner. Documented default
values such as NOTIFICATIONS_APP are supplied explicitly too. The renderer reads
the example as the runtime key list and rejects missing values.

A private mode-0600 manifest is written in runner temporary storage and removed
by a shell trap. Azure responses are suppressed. Never enable shell tracing or
Azure debug output, or upload this manifest. Runtime values become Container Apps
secrets referenced by environment entries; GHCR uses the read:packages token.

Keep API_GATEWAY_URL pointing to the existing Cloudflare gateway. This ticket
does not bind the custom domain, update Neon trusted domains or repoint Systems.
The default address supports reachability checks; full sign-in at the new origin
requires the later domain/Auth cutover. The compiled URL targets the final domain.

## Rollback

Single-revision mode waits for readiness before switching traffic and deactivating
the previous revision. Up to 10 inactive revisions are retained. Revert a bad main
commit to redeploy, or activate a retained revision and route traffic to it:

```sh
az containerapp revision list -g rg-brenraphaels -n portal -o table
az containerapp revision set-mode -g rg-brenraphaels -n portal --mode multiple
az containerapp revision activate -g rg-brenraphaels -n portal --revision <previous>
az containerapp ingress traffic set -g rg-brenraphaels -n portal --revision-weight <previous>=100
```

The next deployment restores single-revision mode. Secrets are application-scoped;
old revisions do not preserve old credential values. Restore GitHub secrets before
redeploying if configuration caused the failure. The old Vercel deployment stays.

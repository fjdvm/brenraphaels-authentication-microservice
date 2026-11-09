# Manual Portal rollback

The **Portal rollback** Actions workflow changes the production image without
changing `main`, rebuilding an image, or replacing the app configuration. Normal
deploys and rollback share the `portal-production` concurrency group and
`scripts/deploy/verify-revision.sh` health checks. A later code merge deploys
`main` again; a rollback does not pin future deployments.

## Owner procedure

1. Open Actions → **Portal rollback** → **Run workflow**, choosing branch `main`.
2. Enter `image`: either the full 40-character SHA of an earlier deployed commit,
   or its complete `ghcr.io/fjdvm/brenraphaels-authentication-microservice:<tag>`
   or `ghcr.io/fjdvm/brenraphaels-authentication-microservice@sha256:<digest>`
   reference. Short SHAs are not accepted. Find previous images in successful
   **Portal container** deployment summaries or GHCR package versions. The image
   must still exist. Documentation-only commits have no production image.
3. Run the workflow. GHCR lookup must succeed before Azure is changed. The tag is
   resolved to a digest, so the selected content cannot move during deployment.
4. Expect a new `portal--rb-<run-id>-<attempt>` revision, a successful health wait,
   default-address `/api/health`, `SniEnabled` custom-domain binding, and public
   `https://portal.buildwrite.me/api/health`. The summary records the previous
   image, requested digest, verified image and final latest-ready revision/image.
   Allow several minutes for Azure rollout; the health wait has a ten-minute limit.
5. To roll forward, run the same workflow with the **previous image** saved in
   the rollback summary. This uses the same validation and health checks.

The workflow uses the existing Azure OIDC secrets and production GHCR pull
credentials; its GitHub token needs package read access. Only images from this
repository's GHCR package are accepted. The workflow runs only on `main`.
Unknown or inaccessible images fail before Azure login/update and leave the live
revision untouched. A resolvable image can still fail at startup; inspect the
failed run and final latest-ready state before selecting a known healthy image.
A failed verification does not mean a rollback automatically occurred.

Azure's image-only update interface is documented in the
[Container Apps CLI reference](https://learn.microsoft.com/en-us/cli/azure/containerapp#az-containerapp-update).

## Verification

Live acceptance belongs to [Ticket#252](https://github.com/fjdvm/brenraphaels-authentication-microservice/issues/252):
roll back to a known previous image, roll forward to the recorded current image,
and try a nonexistent image. Record run URLs, durations, image digests and health
results; for the invalid input, compare the live revision before and after. These
production runs are pending and are not claimed by the implementation PR.

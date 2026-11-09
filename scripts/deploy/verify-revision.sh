#!/usr/bin/env bash
# Shared by normal deployment and manual rollback.
set -euo pipefail

revision="$CONTAINER_APP--$REVISION_SUFFIX"
ready=false
for attempt in $(seq 1 200); do
  state=$(az containerapp revision show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --revision "$revision" --query properties.healthState -o tsv)
  if [ "$state" = Healthy ]; then ready=true; break; fi
  sleep 3
done
if [ "$ready" != true ]; then
  echo "::error::Revision $revision did not become healthy within ten minutes"
  exit 1
fi
fqdn=$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --query properties.configuration.ingress.fqdn -o tsv)
latest=$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --query properties.latestReadyRevisionName -o tsv)
test "$latest" = "$revision"
curl --fail --silent --show-error --retry 6 --retry-all-errors "https://$fqdn/api/health"
bound=$(az containerapp show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" \
  --query "properties.configuration.ingress.customDomains[?name=='$PORTAL_CUSTOM_DOMAIN' && bindingType=='SniEnabled'] | length(@)" -o tsv)
if [ "$bound" != 1 ]; then
  echo "::error::$PORTAL_CUSTOM_DOMAIN is not bound (SniEnabled) to $CONTAINER_APP after the deploy"
  exit 1
fi
curl --fail --silent --show-error --retry 6 --retry-all-errors "https://$PORTAL_CUSTOM_DOMAIN/api/health"
{
  echo '### Portal deployment'
  echo "- Default address: https://$fqdn"
  echo "- Healthy revision: $revision"
  live_image=$(az containerapp revision show -g "$RESOURCE_GROUP" -n "$CONTAINER_APP" --revision "$revision" --query 'properties.template.containers[0].image' -o tsv)
  test "$live_image" = "$PORTAL_IMAGE"
  echo "- Image: $live_image"
  echo '- Replicas: min 1, max 2; 0.5 vCPU / 1 GiB'
  echo '- Previous revisions retained inactive for rollback (up to 10).'
} >> "$GITHUB_STEP_SUMMARY"

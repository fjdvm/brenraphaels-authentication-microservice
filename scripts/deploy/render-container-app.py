"""Render an Azure CLI manifest to a private file; never print secret values."""
import json
import os
from pathlib import Path
import re
import sys

secrets = json.loads(os.environ['DEPLOY_SECRETS'])
keys = re.findall(r'^([A-Z_]+)=', Path('.env.production.example').read_text(), re.M)
keys.remove('NEXT_PUBLIC_APP_URL')
required = keys + ['GHCR_PULL_TOKEN']
missing = [key for key in required if not secrets.get(key)]
if missing:
    sys.exit('Missing GitHub secrets: ' + ', '.join(missing))

def secret_name(key):
    return key.lower().replace('_', '-')

manifest = {
    'location': 'indonesiacentral',
    'properties': {
        'environmentId': os.environ['CONTAINER_ENVIRONMENT_ID'],
        'configuration': {
            'activeRevisionsMode': 'Single',
            'maxInactiveRevisions': 10,
            'secrets': [{'name': secret_name(k), 'value': secrets[k]} for k in required],
            'registries': [{'server': 'ghcr.io', 'username': os.environ['GHCR_USERNAME'],
                            'passwordSecretRef': 'ghcr-pull-token'}],
            'ingress': {'external': True, 'targetPort': 3000, 'transport': 'auto',
                        'allowInsecure': False,
                        'traffic': [{'latestRevision': True, 'weight': 100}]},
        },
        'template': {
            'revisionSuffix': os.environ['REVISION_SUFFIX'],
            'containers': [{
                'name': 'portal', 'image': os.environ['PORTAL_IMAGE'],
                'resources': {'cpu': 0.5, 'memory': '1Gi'},
                'env': ([{'name': k, 'secretRef': secret_name(k)} for k in keys]
                        + [{'name': 'NEXT_PUBLIC_APP_URL', 'value': os.environ['PORTAL_PUBLIC_URL']}]),
                'probes': [{
                    'type': kind,
                    'httpGet': {'path': '/api/health', 'port': 3000, 'scheme': 'HTTP'},
                    'initialDelaySeconds': delay, 'periodSeconds': 10,
                    'timeoutSeconds': 5, 'failureThreshold': failures,
                } for kind, delay, failures in [('Startup', 5, 30), ('Readiness', 5, 3), ('Liveness', 30, 3)]],
            }],
            'scale': {'minReplicas': 1, 'maxReplicas': 2},
        },
    },
}
path = Path(sys.argv[1])
# O_EXCL prevents overwriting an existing file/symlink containing other data.
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    json.dump(manifest, output)

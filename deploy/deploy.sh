#!/usr/bin/env bash
# Deploys the latest main to this server and fails loudly if the API is not healthy afterwards.
#
#   cd /srv/signpakcommons && ./deploy/deploy.sh
#
# Run as the deploy user (not root), from anywhere inside the repository clone.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5000/api/v1/health}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"

cd "$REPO_ROOT"

echo "==> Pulling the latest code"
git pull --ff-only

echo "==> Installing backend production dependencies"
(cd backend && npm ci --omit=dev)

echo "==> Reloading the API under PM2"
pm2 reload deploy/ecosystem.config.cjs --update-env

echo "==> Waiting for ${HEALTH_URL} to report ok (up to ${HEALTH_TIMEOUT_SECONDS}s)"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
body=""
while (( SECONDS < deadline )); do
  if body="$(curl --silent --show-error --max-time 5 "$HEALTH_URL" 2>&1)" && [[ "$body" == *'"status":"ok"'* ]]; then
    echo "==> Healthy: $body"
    exit 0
  fi
  sleep 2
done

echo "!! The API did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s." >&2
echo "!! Last response: ${body:-<none>}" >&2
echo "!! Check: pm2 logs signpakcommons-api --lines 100" >&2
exit 1

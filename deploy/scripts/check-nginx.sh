#!/usr/bin/env bash
# CI check: does deploy/nginx/api.conf pass `nginx -t`?
#
# The real certificate only exists on the server, so this creates a throwaway self-signed one
# at the path the config expects (/etc/letsencrypt/live/api.commons.signpak.tech/) and runs
# nginx -t on the unmodified config in the official nginx images.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# 1.24 matches Ubuntu 24.04's packaged Nginx (22.04 ships 1.18, same syntax); 1.27 is current.
NGINX_IMAGES="${NGINX_IMAGES:-nginx:1.24-alpine nginx:1.27-alpine}"
API_HOST="api.commons.signpak.tech"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if grep -q '<DOMAIN>' "$REPO_ROOT/deploy/nginx/api.conf"; then
  echo "deploy/nginx/api.conf still contains a <DOMAIN> placeholder" >&2
  exit 1
fi

mkdir -p "$WORK/conf.d" "$WORK/letsencrypt/live/${API_HOST}"
cp "$REPO_ROOT/deploy/nginx/api.conf" "$WORK/conf.d/api.conf"

openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -subj "/CN=${API_HOST}" \
  -keyout "$WORK/letsencrypt/live/${API_HOST}/privkey.pem" \
  -out "$WORK/letsencrypt/live/${API_HOST}/fullchain.pem" 2>/dev/null

for image in $NGINX_IMAGES; do
  echo "==> nginx -t with $image"
  docker run --rm \
    -v "$WORK/conf.d:/etc/nginx/conf.d:ro" \
    -v "$WORK/letsencrypt:/etc/letsencrypt:ro" \
    "$image" nginx -t
done

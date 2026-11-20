#!/usr/bin/env bash
# CI check: does deploy/nginx/api.conf pass `nginx -t`?
#
# The real file needs a domain and a Let's Encrypt certificate, neither of which exists in CI,
# so this substitutes <DOMAIN> with example.test, creates a throwaway self-signed certificate at
# the path the config expects, and runs nginx -t in the official nginx images.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# 1.24 matches Ubuntu 24.04's packaged Nginx (22.04 ships 1.18, same syntax); 1.27 is current.
NGINX_IMAGES="${NGINX_IMAGES:-nginx:1.24-alpine nginx:1.27-alpine}"
TEST_DOMAIN="example.test"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/conf.d" "$WORK/letsencrypt/live/api.${TEST_DOMAIN}"
sed "s/<DOMAIN>/${TEST_DOMAIN}/g" "$REPO_ROOT/deploy/nginx/api.conf" > "$WORK/conf.d/api.conf"

if grep -q '<DOMAIN>' "$WORK/conf.d/api.conf"; then
  echo "placeholder substitution failed" >&2
  exit 1
fi

openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -subj "/CN=api.${TEST_DOMAIN}" \
  -keyout "$WORK/letsencrypt/live/api.${TEST_DOMAIN}/privkey.pem" \
  -out "$WORK/letsencrypt/live/api.${TEST_DOMAIN}/fullchain.pem" 2>/dev/null

for image in $NGINX_IMAGES; do
  echo "==> nginx -t with $image"
  docker run --rm \
    -v "$WORK/conf.d:/etc/nginx/conf.d:ro" \
    -v "$WORK/letsencrypt:/etc/letsencrypt:ro" \
    "$image" nginx -t
done

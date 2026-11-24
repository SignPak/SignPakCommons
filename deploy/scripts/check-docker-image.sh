#!/usr/bin/env bash
# Checks a built API image (backend/Dockerfile) the way Coolify will run it (Phase 11, D1).
#
#   docker build -t signpakcommons-api:local backend
#   bash deploy/scripts/check-docker-image.sh signpakcommons-api:local
#
# With MONGODB_URI set (CI: a mongo:7 service container on the runner), the API container uses
# the host network. Without it, the script starts a throwaway mongo:7 container on its own
# network. Everything it starts is removed on exit.
set -euo pipefail
# Git Bash on Windows would rewrite the /app/... arguments into Windows paths.
export MSYS_NO_PATHCONV=1

IMAGE="${1:?usage: check-docker-image.sh <image>}"
RUN_ID="$$"
API="signpak-api-check-${RUN_ID}"
API_LOOPBACK="signpak-api-loopback-${RUN_ID}"
MONGO="signpak-mongo-check-${RUN_ID}"
NETWORK="signpak-check-${RUN_ID}"

cleanup() {
  docker rm -f "$API" "$API_LOOPBACK" "$MONGO" > /dev/null 2>&1 || true
  docker network rm "$NETWORK" > /dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}
pass() {
  echo "ok: $*"
}

# 1. Runs as the non-root node user.
[ "$(docker image inspect -f '{{.Config.User}}' "$IMAGE")" = "node" ] || fail "the image does not set USER node"
[ "$(docker run --rm --entrypoint whoami "$IMAGE")" = "node" ] || fail "whoami is not node"
pass "runs as node"

# 2. Only the app: no tests, scripts, coverage, docs or .env files, and no dev dependencies.
# shellcheck disable=SC2016 # expanded inside the container, not here
docker run --rm --entrypoint sh "$IMAGE" -c '
  cd /app || exit 1
  for path in tests scripts coverage docs .env; do
    if [ -e "$path" ]; then echo "/app/$path is in the image"; exit 1; fi
  done
  found="$(find /app -path /app/node_modules -prune -o -name ".env*" -print)"
  if [ -n "$found" ]; then echo "env files in the image: $found"; exit 1; fi
  for dev in mongodb-memory-server ffmpeg-static c8 nodemon; do
    if [ -e "node_modules/$dev" ]; then echo "dev dependency $dev is in the image"; exit 1; fi
  done
' || fail "the image holds files it should not"
pass "no tests, scripts, coverage, docs, .env files or dev dependencies"

# 3. The app is read-only for node; only uploads/ is writable.
docker run --rm --entrypoint sh "$IMAGE" -c '
  touch /app/uploads/.write-check || { echo "uploads/ is not writable"; exit 1; }
  if touch /app/server.js 2> /dev/null; then echo "the app code is writable"; exit 1; fi
' || fail "file permissions are wrong"
pass "app code read-only, uploads/ writable"

# 4. bcrypt's native binary loads and works.
docker run --rm --entrypoint node "$IMAGE" -e "
  const bcrypt = require('bcrypt')
  const hash = bcrypt.hashSync('check', 4)
  if (!bcrypt.compareSync('check', hash) || bcrypt.compareSync('other', hash)) process.exit(1)
" || fail "bcrypt does not work in the image"
pass "bcrypt hashes and compares"

# 5. A production run, configured as under Coolify, becomes healthy.
if [ -n "${MONGODB_URI:-}" ]; then
  NET_ARGS=(--network host)
  MONGO_URI="$MONGODB_URI"
else
  docker network create "$NETWORK" > /dev/null
  docker run -d --name "$MONGO" --network "$NETWORK" mongo:7 > /dev/null
  NET_ARGS=(--network "$NETWORK" -p 127.0.0.1::5000)
  MONGO_URI="mongodb://${MONGO}:27017/signpak-image-check"
fi

ENV_ARGS=(
  -e "MONGODB_URI=${MONGO_URI}"
  -e TRUST_PROXY=true
  -e CLIENT_ORIGIN=https://commons.signpak.tech
  -e JWT_SECRET=image-check-jwt-secret-image-check-jwt-secret-0123456789
  -e EMAIL_HASH_SECRET=image-check-email-hash-secret-image-check-email-hash
  -e ADMIN_EMAIL=admin@signpak.test
  -e ADMIN_PASSWORD=Admin@12345
  -e BREVO_API_KEY=image-check-placeholder
  -e BREVO_SENDER_EMAIL=no-reply@signpak.tech
  -e WEB3FORMS_ACCESS_KEY=image-check-placeholder
  -e STORAGE_DRIVER=local
  -e ARCHIVE_STORAGE_DRIVER=local
)

docker run -d --name "$API" "${NET_ARGS[@]}" "${ENV_ARGS[@]}" -e HOST=0.0.0.0 "$IMAGE" > /dev/null

status=""
for _ in $(seq 1 90); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$API")"
  [ "$status" = "healthy" ] && break
  if [ "$(docker inspect -f '{{.State.Running}}' "$API")" != "true" ]; then
    docker logs "$API" >&2 || true
    fail "the API container stopped"
  fi
  sleep 1
done
if [ "$status" != "healthy" ]; then
  docker logs "$API" >&2 || true
  fail "the container did not become healthy (last status: $status)"
fi
pass "Docker reports the container healthy"

if [ -n "${MONGODB_URI:-}" ]; then
  BASE_URL="http://127.0.0.1:5000"
else
  BASE_URL="http://$(docker port "$API" 5000/tcp | head -n 1)"
fi
health="$(curl --fail --silent --show-error "${BASE_URL}/api/v1/health")"
echo "$health" | grep -q '"status":"ok"' || fail "health from outside the container: $health"
pass "GET /api/v1/health from outside the container: $health"

logs="$(docker logs "$API" 2>&1)"
echo "$logs" | grep -q '"requestTimeoutMs":900000' || fail "the server did not start with the 15-minute request timeout"
pass "requestTimeout is 900000 ms"
if echo "$logs" | grep -q 'cannot reach the API'; then
  fail "the container-on-loopback warning fired with HOST=0.0.0.0"
fi

# 6. With HOST unset, the container listens on loopback, and the server says so at startup.
docker run -d --name "$API_LOOPBACK" "${NET_ARGS[@]}" "${ENV_ARGS[@]}" -e PORT=5001 "$IMAGE" > /dev/null
started=""
for _ in $(seq 1 30); do
  if docker logs "$API_LOOPBACK" 2>&1 | grep -q 'API server listening'; then started="yes"; break; fi
  sleep 1
done
[ -n "$started" ] || { docker logs "$API_LOOPBACK" >&2 || true; fail "the loopback container did not start"; }
docker logs "$API_LOOPBACK" 2>&1 | grep -q 'HOST is 127.0.0.1 inside a container' || fail "no warning for HOST=127.0.0.1 in a container"
docker rm -f "$API_LOOPBACK" > /dev/null
pass "HOST unset in a container is warned about"

# 7. SIGTERM drains and exits 0 well within Coolify's 30 s stop grace period.
docker stop -t 30 "$API" > /dev/null
exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$API")"
[ "$exit_code" = "0" ] || { docker logs "$API" >&2 || true; fail "exit code $exit_code after docker stop"; }
docker logs "$API" 2>&1 | grep -q '"msg":"Shutdown complete"' || fail "no 'Shutdown complete' in the logs"
pass "docker stop: graceful shutdown, exit 0"

echo "All image checks passed for $IMAGE"

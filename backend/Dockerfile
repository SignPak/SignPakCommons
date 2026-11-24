# The SignPak Commons API image (Phase 11, decision D1: Coolify on the Hostinger KVM-8).
#
#   docker build -t signpakcommons-api backend
#
# Coolify builds it from this repo (Base Directory /backend) and runs it behind Traefik; the
# settings are in deploy/README.md. The configuration comes from environment variables set in
# Coolify: the image never contains a .env file (.dockerignore sends only the app).
# CI checks the built image with deploy/scripts/check-docker-image.sh.

# Production dependencies only: no test runner, mongodb-memory-server or ffmpeg-static. bcrypt
# ships prebuilt Linux binaries, so no compiler is needed (the CI image check proves it loads).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

# The app is owned by root, so the node user can read it but not change it. uploads/ (temporary
# files on their way to Google Drive) is the only directory it can write to.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json server.js ./
COPY src ./src
RUN mkdir uploads && chown node:node uploads

USER node
EXPOSE 5000

# /api/v1/health answers 200 only when MongoDB and storage are ready (503 otherwise), so a new
# container that cannot work never replaces a healthy one in a rolling update. The slim image
# has no curl or wget, so the check uses node. Coolify uses this check when its own
# Healthcheck setting is off (deploy/README.md). --start-interval needs Docker Engine 25+.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Exec form: Node is PID 1 and receives SIGTERM itself, then drains for up to 10 s
# (src/utils/gracefulShutdown.js). Coolify waits 30 s by default before forcing a stop.
CMD ["node", "server.js"]

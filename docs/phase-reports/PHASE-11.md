# Phase 11 – Deployment on Coolify

## Phase and branch

| | |
| --- | --- |
| Phase | 11 – Deployment on Coolify (new decision, replacing D1's Nginx + PM2 setup as the main path) |
| Branch | `fix/phase-11-coolify` (from `main` @ `0ac4668`, Phase 10 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.16 → 1.0.17`; frontend unchanged at `1.0.18` (no frontend change) |

## The decision

The API runs on the team's **Hostinger KVM-8** (Ubuntu) as a **Coolify** application built
from this repo (`backend/Dockerfile`). Coolify's **Traefik** is the reverse proxy and gets the
Let's Encrypt certificate for `api.commons.signpak.tech`. The site stays on Vercel and MongoDB
on Atlas. `deploy/` keeps Nginx, PM2 and `deploy.sh` as the documented alternative for a bare
server; `deploy/README.md` now starts with Coolify. `docs/FIX-PLAN.md` has a note under D1.

## Items

| # | Item | Status | Summary |
| --- | --- | --- | --- |
| 1 | `backend/Dockerfile`, `.dockerignore` | **Done** | Two stages on `node:22-bookworm-slim`; `npm ci --omit=dev`; `NODE_ENV=production`; runs as `node`; `EXPOSE 5000`; `HEALTHCHECK` on `/api/v1/health` (with `node`). `.dockerignore` is an allowlist. bcrypt loads from its prebuilt binary (no compiler needed): checked in the image. |
| 2 | `HOST=0.0.0.0` under Coolify | **Done** | Documented in `deploy/README.md`, `setup.md` and `.env.production.example`, with the condition: no host port published. The 127.0.0.1 default stays for a bare server. The server now warns when it runs in a container on loopback. |
| 3 | `REQUEST_TIMEOUT_MS` | **Done** | Default 900000 (15 min), allowed 60000–3600000; sets `server.requestTimeout` (`src/utils/httpServer.js`). `headersTimeout` and `keepAliveTimeout` unchanged. In `env.js`, both `.env` examples and `setup.md`. |
| 4 | Graceful shutdown vs. the stop grace period | **Fits; no change** | The API drains for up to 10 s. Coolify's Stop Grace Period is 30 s when left empty. Documented; the CI image check runs `docker stop` and requires exit 0 and "Shutdown complete". |
| 5 | `deploy/README.md` Coolify section | **Done** | Section 2, with the exact settings, in the order you gave. |
| 6 | CI: "Docker image" and "Deploy (Coolify)" jobs | **Done** | See below. |
| 7 | Tests and records | **Done** | U-213–U-219, I-163; TEST-CASES, CHANGELOG, FIX-PLAN note, this report. |

## Three places where Coolify works differently from the brief

Found in Coolify's docs and source while planning, and approved with the plan:

1. **The deploy webhook needs `POST`.** Coolify v4 routes `GET /api/v1/deploy` to a handler
   that answers `405` ("This endpoint has changed to a POST request"). The CI call is therefore
   `curl --fail -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_WEBHOOK"`. The token
   needs only the `deploy` permission, and Settings → Advanced → **API Access** must be on.
2. **Coolify's own HTTP health check needs `curl` or `wget` inside the image**, and the slim
   image has neither. Instead of adding curl, the image has its own `HEALTHCHECK` on
   `/api/v1/health` (run with `node`), and Coolify's Healthcheck setting stays **off**: Coolify
   then uses the image's check, also for rolling updates.
3. **The stop grace period needs no change.** Coolify's default is 30 s (Advanced →
   Operations → Stop Grace Period, empty); the drain is 10 s. Plain `docker stop` waits only
   10 s, so the README says `--stop-timeout 30` for anyone running the image by hand.

## What changed

### Backend
- `Dockerfile`, `.dockerignore` (new). The app code is owned by root and read-only for `node`;
  `uploads/` is the only writable directory (temporary files on their way to Drive; no volume
  needed). `CMD ["node", "server.js"]` in exec form, so Node is PID 1 and gets SIGTERM itself.
  `--start-interval=2s` in the health check needs Docker Engine 25+ (README says to check).
- `src/utils/httpServer.js` (new): `startHttpServer()` creates the server with
  `requestTimeout` from `REQUEST_TIMEOUT_MS`; `server.js` uses it and logs `requestTimeoutMs`
  at startup.
- `src/config/env.js`: `REQUEST_TIMEOUT_MS`.
- `src/config/startupChecks.js`: a warning when production runs in a container (`/.dockerenv`)
  with `HOST` on loopback, since Traefik could not reach it while the image's own health check
  still passes.
- Comments in `server.js` and `gracefulShutdown.js`; `.env.example`, `.env.production.example`
  (header, `HOST`, `TRUST_PROXY`, `REQUEST_TIMEOUT_MS`, upload-limit note).

### `deploy/`
- `README.md` restructured: 0 Before you start, 1 DNS and Brevo, **2 the API on Coolify**
  (2.1 Traefik `readTimeout`, 2.2 the application, 2.3 network settings, 2.4 health check and
  shutdown, 2.5 environment variables, 2.6 deploys from CI, 2.7 Atlas, 2.8 first deploy, logs
  and checks), 3 Vercel, 4 Google Drive (D3), 5 what to send back; then **"Alternative: a bare
  server with Nginx + PM2"** with the earlier sections as B1–B11.
- `scripts/check-docker-image.sh` (new): the image check CI runs (below); also runs locally.

### CI (`.github/workflows/ci.yml`)
- **Docker image** (`docker-image`): a `mongo:7` service container; `docker build` of
  `backend/`; then `check-docker-image.sh`, which fails unless:
  - the image's user and `whoami` are `node`;
  - `/app` has no `tests`, `scripts`, `coverage`, `docs` or `.env*` file, and no dev
    dependency (`mongodb-memory-server`, `ffmpeg-static`, `c8`, `nodemon`);
  - the app code is read-only and `uploads/` writable for `node`;
  - bcrypt hashes and compares;
  - a production run (`HOST=0.0.0.0`, `TRUST_PROXY=true`, local storage, placeholder keys)
    becomes **healthy** in Docker, `/api/v1/health` answers `"status":"ok"` from outside, and
    the log shows `"requestTimeoutMs":900000`;
  - with `HOST` unset, the container warns that it listens on loopback;
  - `docker stop -t 30` exits 0 with "Shutdown complete".
- **Deploy (Coolify)** (`deploy-coolify`): only on a push to `main`, `needs` every other job,
  `concurrency: coolify-deploy`. With `COOLIFY_TOKEN` and `COOLIFY_WEBHOOK` set it POSTs to the
  webhook; without them it passes with a "Deploy skipped" notice.
- The deploy-files job also runs `bash -n` and shellcheck on the new script.

### Docs
- `backend/docs/setup.md` (`HOST`, `REQUEST_TIMEOUT_MS`, `TRUST_PROXY`, admin restart, the
  production checklist), `ARCHITECTURE.md`, `MODULE-REFERENCE.md`, `backend/README.md`, the
  root `README.md`.
- `docs/SRS-CHANGES.md` entries 1–3 (Figure 5, §3.3.4, Table 15) and the SE note now describe
  Coolify on the Hostinger KVM-8 instead of Nginx + PM2.
- `docs/FIX-PLAN.md`: a note under the decisions table that D1 is now Coolify.
- No API change, so the OpenAPI spec and the API reference are unchanged.

## Tests

| ID | Level | Test |
| --- | --- | --- |
| U-213 | unit | `httpServer.test.js` – the server gets `REQUEST_TIMEOUT_MS` as `requestTimeout`; `headersTimeout` and `keepAliveTimeout` keep Node's defaults |
| U-214 | unit | `httpServer.test.js` – default 15 minutes, a value is taken, `0`, text, `59999` and `-1` are refused |
| U-215 | unit | `startupChecks.test.js` – the container-on-loopback warning (127.0.0.1 and ::1; not for 0.0.0.0, outside a container or outside production) |
| U-216 | unit | `deployConfig.test.js` – the Dockerfile (base image matches `.nvmrc`, `npm ci --omit=dev`, `USER node`, `EXPOSE` = `PORT`, exec-form `CMD`, `node` health check on `/api/v1/health`) |
| U-217 | unit | `deployConfig.test.js` – `.dockerignore` sends the app and keeps out tests, every `.env*` (also in `src/`), node_modules, coverage, uploads, scripts, docs |
| U-218 | unit | `deployConfig.test.js` – the Coolify guide comes before PM2 and names the settings; Traefik's `readTimeout` ≥ `REQUEST_TIMEOUT_MS` for both entry points |
| U-219 | unit | `deployConfig.test.js` – CI has the image job (mongo service, build, check script) and a deploy job only for pushes to `main`, needing every other job, POSTing with the secrets, with the skip notice |
| I-163 | integration | `requestTimeout.test.js` – a real server with a 300 ms limit: a body still arriving after it gets `408` and the connection closes; a request within it gets `200` |
| — | system (CI) | `deploy/scripts/check-docker-image.sh` on the built image, listed above |

**Failing first:** before the code existed, `httpServer.test.js` and `requestTimeout.test.js`
failed (module not found), the new startup-check test failed, and `deployConfig.test.js`
failed (no `backend/Dockerfile`). No existing test was changed, skipped or weakened; the
coverage thresholds are unchanged.

## Test gate results

| Gate | Result |
| --- | --- |
| Backend `test:unit` | 219 passed, 0 failed, 0 skipped |
| Backend `test:integration` | 163 passed, 0 failed, 0 skipped (after the fix below) |
| Backend `test:security` | 81 passed, 0 failed, 0 skipped |
| Backend `test:coverage` | 463 passed; 94.70% lines, 90.39% branches (floors 85% / 75%); services 90.81% / 89.18%, middlewares 98.38% / 88.16%, utils 99.51% / 94.12% (floors 80% / 75%), unchanged |
| Frontend `lint` | clean |
| Frontend `test` | 218 passed |
| Frontend `test:coverage` | 55.19% lines, 52.98% statements, 48.33% branches, 51.40% functions; floors met, unchanged |
| Frontend `build` + `check:bundle` | main chunk 268.95 kB (limit 300 kB) |
| E2E | 87 passed, 6 skipped (Chromium-only by design, as in Phase 10), 3 engines, all under the CSP |
| `npm audit --omit=dev --audit-level=high` | backend 0, frontend 0, e2e 0 |
| Image check, locally (`docker build` + `check-docker-image.sh`, Docker 29) | all 9 checks passed: `node` user; no tests, scripts, coverage, docs, `.env` or dev dependencies; read-only app, writable `uploads/`; bcrypt; healthy in ~3 s; health `{"status":"ok","database":"connected","storage":true}`; `requestTimeoutMs` 900000; loopback warning; `docker stop` exit 0. Image size 658 MB unpacked (most of it `googleapis`). |
| Image check, negative controls | an image with `USER root` fails ("the image does not set USER node"); one with `/app/.env` fails ("/app/.env is in the image") |
| shellcheck (`koalaman/shellcheck:stable`) and `bash -n` | `deploy.sh`, `check-nginx.sh`, `check-docker-image.sh` clean |

**A flaky test found and fixed before commit.** The first integration run (with the frontend
gate running alongside) failed I-163 once: the client received nothing instead of the 408. The
cause was in the test, not the server. The client kept writing body pieces every 100 ms; a
piece that reached the server after it had closed was answered with a TCP reset, and on
Windows a reset makes the client drop the 408 it had received but not yet read. Under three
parallel runs, the old timing failed 1 of 15. Now the body stalls for 1.5 s (no writes while
the server times out): 45 of 45 passed under the same load, and the full suite passed. No
retry or longer timeout was added; the 300 ms limit is unchanged.

### CI

The CI runs for the last commit, including the new "Docker image" job, are given in the hand-off
message and in a PR comment. "Deploy (Coolify)" does not run on a branch or a pull request; it
first runs after the merge to `main`, and passes with "Deploy skipped" until the two secrets
exist.

## To do on the server (team)

Not verifiable from here; the steps are in `deploy/README.md` section 2.

| # | Step | Done |
| --- | --- | --- |
| 1 | DNS: `A api.commons → <SERVER_IP>` (no Cloudflare proxy in front of the API) | ☐ |
| 2 | Traefik: both `readTimeout=900s` lines added, Save, Restart Proxy | ☐ |
| 3 | Application: repo, branch `main`, Base Directory `/backend`, Build Pack Dockerfile, Dockerfile Location `/Dockerfile` | ☐ |
| 4 | Domain `https://api.commons.signpak.tech`, Ports Exposes `5000`, **Ports Mappings empty**, one replica, memory limit 1 GB | ☐ |
| 5 | Coolify Healthcheck off (the image's check is used); Stop Grace Period empty | ☐ |
| 6 | Environment variables from `.env.production.example` with `HOST=0.0.0.0` and `TRUST_PROXY=true`, secrets filled | ☐ |
| 7 | Auto deploy: **Manual deployments only**; API Access on; a `deploy`-only token | ☐ |
| 8 | GitHub secrets `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` | ☐ |
| 9 | Atlas Network Access: the server's IP | ☐ |
| 10 | First deploy: health over HTTPS shows `"status":"ok"`, `"database":"connected"`, `"storage":true`; the log shows `"host":"0.0.0.0"`, `"requestTimeoutMs":900000` | ☐ |
| 11 | Real visitor IPs in `clientIp`, not a Docker address | ☐ |
| 12 | A ~90 MB recording upload succeeds, also on a slow connection (more than 60 s), and one over 100 MB gets the API's 413 message | ☐ |
| 13 | A redeploy from CI: the run's **Deploy (Coolify)** job succeeds, and Coolify's log shows "New container is healthy" and "Rolling update completed" | ☐ |
| 14 | `docker version` on the server is 25 or newer; `/etc/docker/daemon.json` rotates logs | ☐ |

The Phase 10 items that wait for production (the `@smoke` run, the §10.6 manual checklist, the
Brevo, `EMAIL_HASH_SECRET`, `ADMIN_EMAILS` and `/ffmpeg/ffmpeg-core.wasm` checks, and D3's
consent screen) are unchanged and follow once the API is live.

## How to verify by hand

```sh
docker build -t signpakcommons-api:local backend
bash deploy/scripts/check-docker-image.sh signpakcommons-api:local   # starts its own mongo:7
cd backend && node --test tests/unit/httpServer.test.js tests/integration/requestTimeout.test.js
```

## Not done, and deviations

- The three Coolify differences above (POST, the image's health check, no grace-period change).
- Coolify and Traefik themselves can only be checked on the server (table above).
- The deploy job only queues the deploy; whether it succeeded shows in Coolify, not in CI. The
  health of the new container is what Coolify waits for before switching over.

## Known risks

- Traefik's `readTimeout=900s` applies to every application on the server.
- An upload still running 10 s after a redeploy starts is cut off (as with PM2 before); the
  contributor sends it again.
- Other containers on Coolify's Docker network can reach port 5000 directly; nothing untrusted
  should run on that server.
- `HEALTHCHECK --start-interval` needs Docker Engine 25+.

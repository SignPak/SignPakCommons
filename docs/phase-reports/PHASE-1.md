# Phase 1 – Server deployment, domain and sessions (C1, C4, S3, S5)

## Phase and branch

| | |
| --- | --- |
| Phase | 1 – Server deployment, domain and sessions (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-1-server-domain-sessions` (from `main` @ `ea43411`, Phase 0 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.6 → 1.0.7`, frontend `1.0.9 → 1.0.10` |

The domain and the server (D1/D2) are not decided yet. Every real hostname is the `<DOMAIN>`
placeholder in code, config and docs, as section 0 says. **All four real-server "done when"
checks are pending** (end of this report); nothing here claims them.

## Checklist items

| ID | State | How |
| --- | --- | --- |
| **S5** | **Done, ticked** | `serviceUnavailableBody()` in `src/services/initialization.js` adds `detail` only outside production. Proven against a real production process (security test S-06–S-08). |
| **C1** | Code done; **deployment pending** | `deploy/`: Nginx site, PM2 definition, `deploy.sh`, server guide. Health reports storage. Graceful shutdown. Production env template. The Vercel handler and the `process.env.VERCEL` branch are removed (D1). |
| **C4** | Code done; **real-browser checks pending** | No cookie code change needed: the cookie was already host-only (`src/utils/tokens.js` sets no `Domain`). The fix is the D2 layout (`commons.<DOMAIN>` + `api.<DOMAIN>`) plus `COOKIE_SAMESITE=lax`, proven across two real hostnames in all three engines (E-04). |
| **S3** | Code done; **log check pending** | `TRUST_PROXY=true` in the production template. Startup warning when it is off in production. Request logs now record the visitor IP (`clientIp`). One PM2 process keeps the in-memory rate limits correct (D1). Not done, by FIX-PLAN's decision: an Upstash-backed rate-limit store. |
| Leftover: `SITE_URL` | Code done; **Vercel value pending** | Read from the `SITE_URL` env var, default `https://commons.<DOMAIN>`, with a build warning while it is unset. |

## What I found while doing it (beyond the plan)

1. **The request logs could never have shown real visitor IPs.** pino-http logs
   `req.socket.remoteAddress`, which behind Nginx is always `127.0.0.1`, whatever
   `TRUST_PROXY` says. So FIX-PLAN's done-when "the server logs show the real visitor IPs"
   could not pass on the real server. Fixed with `src/utils/requestLog.js`: every request line
   now has `clientIp` = `req.ip`. Verified on a real log line: `remoteAddress: 127.0.0.1`,
   `clientIp: 203.0.113.7`.
2. **The health check would have answered a 500 after 10 seconds when the database was down.**
   Once health bypassed the init guard (needed so it can *report* a failed init), it still went
   through `enforceAccessRestrictions`. That middleware queries MongoDB, and Mongoose buffers the
   query for 10 s before throwing. The new security test caught it. Fix: the restriction lookup
   is skipped for `/health` only, and only while the database is disconnected; with no database
   there are no restriction records to enforce. The existing device-restriction tests on
   `/health` (which need the database up) still pass. Health now answers in about 5 ms.
3. **`http2 on;` would not load on a stock Ubuntu server.** It needs Nginx ≥ 1.25.1; Ubuntu
   22.04/24.04 ship 1.18/1.24. The config uses `listen 443 ssl http2` instead, and CI runs
   `nginx -t` on both 1.24 and 1.27 (1.27 prints a deprecation notice, which is expected).
4. **Forcing `Cache-Control: no-store` on `/api/` in Nginx would have broken poster caching**:
   the API already sets `Cache-Control` per response (`private, max-age=300` on posters), and
   Nginx would have added a second, conflicting header. "No caching of `/api/`" is met by Nginx
   never caching (`proxy_no_cache`, no `proxy_cache` anywhere); browser caching stays with the
   API.
5. **A line-ending bug in my own Phase 0 traceability test.** It read `TEST-CASES.md`, split on
   `\n` and anchored rows on `|$`. On a Windows checkout (`core.autocrlf=true`) the file has
   CRLF, so it parsed 0 rows. It had passed only because the file happened to be LF, and CI on
   Linux always is. Both file-reading tests now normalise line endings. The guard still rejects
   a bad mapping (checked by setting I-04 back to SE-5). The same mechanism would turn
   `deploy.sh` into CRLF on a Windows checkout and break it in bash, so a new `.gitattributes`
   pins `*.sh` and `deploy/nginx/*.conf` to LF.
6. **Playwright's Windows WebKit does not implement SameSite.** Details under *Known risks*.
   It changed how the C4 test is written.

## Files changed

**Backend — source**
- `src/services/initialization.js` — S5 `serviceUnavailableBody()`; `isStorageReady()`;
  `GET /api/v1/health` passes the init guard (still starts init); `console.*` replaced by
  the pino logger.
- `src/controllers/healthController.js` **(new)** — `buildHealth()` (booleans only); moved
  out of `routes/index.js` (layering).
- `src/config/startupChecks.js` **(new)** — `startupWarnings(env)`.
- `src/utils/gracefulShutdown.js` **(new)** — `createShutdown()`.
- `src/utils/requestLog.js` **(new)** — `clientIp` on request logs.
- `server.js` — the Vercel handler and its export are removed; startup warnings; graceful
  shutdown on `SIGTERM`/`SIGINT`.
- `src/app.js` — `customProps: requestLogProps`; proxy comment.
- `src/middlewares/enforceAccessRestrictions.js` — health is not blocked by a missing database.
- `src/services/storage/index.js` — the `process.env.VERCEL` branch is removed (D1).
- `src/routes/index.js`, `src/docs/openapi.js`, `docs/API.md` — health response
  (`storage`, 200/503).
- `.env.example` (dev; hosting wording only), `.env.production.example` **(new)**.
- `coverage-thresholds.json` — `src/services` lines floor 77 → **78** (measured 78.52%).
- `package.json` / lock — `1.0.7`.

**Backend — tests:** see *Tests added* below. `tests/support/productionApp.js` and
`tests/support/trustProxyEnv.js` are new fixtures. `tests/unit/traceability.test.js` is now
CRLF-safe.

**Frontend**
- `src/seo/seoCatalog.mjs` — `DEFAULT_SITE_URL`, `resolveSiteUrl()`, `SITE_URL` from env.
- `vite.config.js` — `define: { __SITE_URL__ }`; `preview.allowedHosts: ['.localtest.me']`.
- `scripts/generateSeoAssets.js` — warning while `SITE_URL` is the placeholder.
- `README.md`, `docs/architecture.md` — `SITE_URL` and `VITE_API_ORIGIN` for Vercel, and the
  D2 layout.
- `package.json` / lock — `1.0.10`.

**Deploy (new):** `deploy/nginx/api.conf`, `deploy/ecosystem.config.cjs`, `deploy/deploy.sh`,
`deploy/scripts/check-nginx.sh`, `deploy/README.md`.

**E2E:** `playwright.config.js` (third server: a cross-host build on
`commons.localtest.me:4174`; the API listens dual-stack), `support/flows.js` **(new, shared
sign-up flow)**, `tests/cross-host-cookie.spec.js` **(new)**, `tests/signup.spec.js` (now uses
the shared flow; same steps).

**CI:** `.github/workflows/ci.yml` — new `deploy` job (`bash -n`, `shellcheck`, `nginx -t` on
1.24 and 1.27); e2e job pins the two `localtest.me` names in `/etc/hosts`.

**Repo:** `.gitattributes` **(new)**; `.gitignore` (`frontend/dist-crosshost/`).

**Docs:** `backend/docs/{ARCHITECTURE,MODULE-REFERENCE,setup,TEST-CASES}.md`,
`backend/README.md`, the review checklist.

## New routes, models and environment variables

- **Routes:** none new. `GET /api/v1/health` adds `storage: true|false` and returns `503
  degraded` when storage failed to initialize, as it already did for the database. It now
  answers even when initialization failed.
- **Models:** none.
- **Backend env:** none new. New file `backend/.env.production.example`.
- **Frontend env:** `SITE_URL` (build time; deliberately not `VITE_`-prefixed, because the Node
  SEO script reads it too).
- **Test-only env** (`backend/scripts/e2e-server.js`): `E2E_API_HOST`.

## Tests added

Every checklist item in this phase has a regression test named with its ID.

**Unit (backend, 20 new)**
- `initialization.test.js`
  - S5: production 503 bodies carry no detail
  - S5: development 503 bodies keep the detail for debugging
  - S5: a missing error still gives a well-formed body
- `startupChecks.test.js`
  - S3: warns when TRUST_PROXY is off in production
  - S3: no proxy warning in production when TRUST_PROXY is on
  - S3: no proxy warning outside production
- `gracefulShutdown.test.js`
  - C1: shutdown stops accepting requests, closes MongoDB and exits 0
  - C1: a second signal during shutdown is ignored
  - C1: shutdown forces exit 1 when draining takes too long
  - C1: a failure while closing exits 1 instead of hanging
- `healthController.test.js`
  - C1: health is ok only when the database and storage are both up
  - C1: health exposes booleans and counters only
- `requestLog.test.js`
  - S3: request logs record the client IP Express resolved, not the proxy socket
  - S3: request logs fall back to the socket address when req.ip is unavailable
- `deployConfig.test.js`
  - C1: nginx config sets the body limit, unbuffered uploads, timeouts and forwarding headers
  - C1: nginx body limit leaves room above the API upload limit
  - C1: PM2 runs exactly one fork-mode process
  - C1: deploy.sh stops on errors and fails unless health reports ok
  - C1: deploy files use the <DOMAIN> placeholder, never a real host
  - C1: the production env template is a valid production configuration once filled in

**Integration (backend, 4 new)**
- `api-basics.test.js`
  - C1: health reports database and storage status
  - S3: without TRUST_PROXY a forged X-Forwarded-For is ignored
  - C4: the session cookie is host-only, HttpOnly and SameSite=Lax
- `api-proxy.test.js` (own process, `TRUST_PROXY=true`)
  - S3: with TRUST_PROXY=true the client IP comes from X-Forwarded-For. This also proves a
    client can't spoof past Nginx, because only the right-most `X-Forwarded-For` entry counts.

The two S3 tests together show the flag is what decides: the same header is ignored without
it and honoured with it.

**Security (backend, 3 new):** `production-errors.test.js` runs the real app in a child process
with `NODE_ENV=production` and an unparseable `MONGODB_URI` carrying a fake password.
- S5: the production 503 has no detail and does not echo the error
- S5: every route answers with the same generic body while initialization fails
- C1: the production health check reports the failure as booleans only

**Unit (frontend, 3 new):** `seoCatalog.test.js`
- C1: SITE_URL defaults to https://commons.<DOMAIN>
- C1: an explicit SITE_URL is used, with a trailing slash trimmed
- C1: no longer points at the old signpakcommons.example placeholder

**E2E (1 new spec × 3 engines):** `cross-host-cookie.spec.js` — C4: login cookie set by
api.localtest.me works on commons.localtest.me. The site is a separate build pointed at the
API's own hostname (no proxy, as on Vercel). The test runs these steps:
1. Sign up on `commons.`, then check the `Set-Cookie` header from `api.`: `SameSite=Lax`,
   `HttpOnly`, no `Domain`. The browser stores the cookie for the API host only.
2. Reload: still signed in.
3. Log out through the UI: `/home` now redirects to login and the cookie is gone.
4. Log in, reload: still signed in.
5. **Negative control:** the same credentialed request made from a different *site*
   (`127.0.0.1`) must come back signed-out. This proves the test depends on site-ness, not on
   cookies always flowing.

**Deploy check (CI):** `nginx -t` on `api.conf` with Nginx 1.24 and 1.27, plus `shellcheck`
on both scripts. Run locally too: `nginx -t` passed on both versions in Docker, and
shellcheck v0.10.0 was clean.

**Traceability:** 31 new rows in `backend/docs/TEST-CASES.md` (U-38–U-57, I-46–I-49,
S-06–S-08, FU-21–FU-23, E-04); the traceability test validates every row.

No existing test was removed, skipped or weakened. `signup.spec.js` moved its steps into
`support/flows.js` unchanged.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 20 Nov 2026, pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 57, pass 57, fail 0 | 0 |
| backend `test:integration` | tests 49, suites 11, pass 49, fail 0 | 0 |
| backend `test:security` | tests 54, suites 3, pass 54, fail 0 | 0 |
| backend `test:coverage` | tests 160, pass 160; floors passed (table below) | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 8 passed (8), Tests 27 passed (27) | 0 |
| frontend `test:coverage` | thresholds passed | 0 |
| frontend `build` | built; main chunk 526.13 kB; prints the expected `SITE_URL` placeholder warning | 0 |
| `e2e` | **12 passed (46.3 s)** — 4 tests × chromium, firefox, webkit | 0 |
| backend `npm audit --omit=dev --audit-level=high` | 6 vulnerabilities (2 moderate, 4 high) | 1 (expected until Phase 3) |
| frontend `npm audit --omit=dev --audit-level=high` | 2 high | 1 (expected until Phase 3) |

### Coverage, before and after

| Scope | Phase 0 | Phase 1 | Floor | FIX-PLAN target |
| --- | --- | --- | --- | --- |
| Backend overall | 86.77% lines / 85.09% branches | **87.81% / 85.88%** | 75 / 75 | 75 lines |
| `src/services` | 77.77% / 82.09% | **78.52% / 82.61%** | **78** (was 77) / 75 | 80 / 75 |
| `src/middlewares` | 97.87% / 86.96% | **97.91% / 86.52%** | 80 / 75 | 80 / 75 |
| `src/utils` | 82.67% / 89.36% | **86.43% / 89.29%** | 80 / 75 | 80 / 75 |
| Frontend overall | 18.90% lines | **18.90%** (unchanged: `src/seo/**` is excluded from coverage) | 18 | 70 |

### CI

Run [44792032562](https://github.com/SignPak/SignPakCommons/actions/runs/44792032562) on the
Phase 1 commit, overall conclusion **success**:

| Job | Result |
| --- | --- |
| Backend (unit, integration, security, coverage) | success |
| Frontend (lint, test, coverage, build) | success — Tests 27 passed (27) |
| End-to-end (Playwright) | success — "12 passed (35.8s)", including the C4 cross-host test in Linux WebKit with the negative control |
| Deploy files (shellcheck, nginx -t) | success — `nginx -t` "test is successful" on 1.24-alpine and 1.27-alpine |
| Dependency audit | failure, tolerated until Phase 3 |

## Real-server "done when" — all pending

**Blocked on: the domain and the server (D1/D2).** The steps are in `deploy/README.md`; its
last section lists what to send back so the placeholders can be replaced and these can be run.

- [ ] `https://api.<DOMAIN>/api/v1/health` returns OK with a valid certificate.
- [ ] Sign-up, login and logout work in Chrome, Firefox, Safari (macOS and iOS) and a private window.
- [ ] A recording of about 90 MB uploads successfully.
- [ ] The server logs show the real visitor IPs, not 127.0.0.1 (`clientIp` field).

## How to verify by hand

```sh
git switch fix/phase-1-server-domain-sessions
cd backend  && npm ci && npm run test:unit && npm run test:integration && npm run test:security && npm run test:coverage
cd ../frontend && npm ci && npm run lint && npm test && npm run test:coverage && npm run build
cd ../e2e && npm ci && npm run e2e
```

Spot checks:
1. **S5:** set `NODE_ENV=production` plus the required production values and a broken
   `MONGODB_URI`, start the server, then `curl /api/v1/categories`. The 503 body has no
   `detail`. Without `NODE_ENV=production` it does.
2. **Health:** `curl http://localhost:5000/api/v1/health` shows `"storage":true`. Stop MongoDB
   and it answers immediately with `503 degraded`, `"database":"disconnected"`.
3. **Startup warning:** start with `NODE_ENV=production` and `TRUST_PROXY=false`; the first log
   line warns about `TRUST_PROXY`.
4. **Graceful shutdown:** `npm start`, then Ctrl+C: "Shutting down" and "Shutdown complete"
   are logged, and the process exits 0.
5. **Cross-host cookie:** `cd e2e && npx playwright test tests/cross-host-cookie.spec.js
   --headed --project=chromium` and watch sign-up, reload, log out, log in on
   `commons.localtest.me`.

## Not done, and deviations from the plan

1. **The production values went into a new `backend/.env.production.example`**, not into
   `.env.example` as FIX-PLAN 1.6 says. That was your choice during planning: `.env.example`
   is the local-dev template, and production values (Drive storage, Secure cookies) would stop
   a fresh local copy from starting.
2. **Health now bypasses the init guard**, and the restriction check is skipped for `/health`
   while the database is down (finding 2). Both were needed for health to report a failed
   initialization instead of a generic 503 or a slow 500.
3. **Two additions to S3 beyond FIX-PLAN's list:** `clientIp` in request logs (finding 1), and
   a test that a spoofed left-hand `X-Forwarded-For` entry is ignored.
4. **No Upstash-backed rate-limit store** (checklist S3 says "consider" it). FIX-PLAN D1
   decides on one PM2 process instead, and `deployConfig.test.js` pins `instances: 1`.
5. **The S5 and S3-warning tests map to "— (deployment safety)" in TEST-CASES.md.** None of the
   SRS security requirements (SE-1–SE-10 as defined in Phase 0's fixes) covers error
   disclosure or proxy configuration. Health, shutdown and deploy tests map to QA-3
   (availability).
6. **`.gitattributes` and the CRLF fix to the Phase 0 traceability test** were not in the plan
   (finding 5).
7. **Leftover hosting wording** (Railway/Render/Vercel) is removed from the backend `.env.example`,
   `app.js`, README, ARCHITECTURE and setup docs.

## Known risks

1. **Nothing has run on a real server.** C1, C4, S3 and the `SITE_URL` leftover stay unticked
   until the four checks above pass.
2. **WebKit's SameSite proof comes from CI, not from this machine — and CI confirmed it.**
   Playwright's *Windows* WebKit build does not implement SameSite: it received `SameSite=Lax`
   in the header, stored the cookie as `None`, and sent it cross-site in the negative control.
   Chromium and Firefox withheld it correctly. So the negative control is skipped only for
   WebKit on Windows, with a visible test annotation. **CI run 44792032562 (Ubuntu, Linux
   WebKit) ran the full test including the negative control, and it passed**: Linux WebKit
   withholds the `Lax` cookie from another site and sends it from `commons.` to `api.`.
   Playwright's WebKit is a valid stand-in for Safari here; the real-iOS check on the deployed
   domain remains as the final confirmation.
3. **Health `storage: true` doesn't prove the Drive token works.** The Drive driver has no
   `init()`, so an expired refresh token only shows on the first upload. Phase 2's D3 work adds
   the `invalid_grant` log.
4. **The API still binds `0.0.0.0:5000`** (FIX-PLAN: keep the plain `app.listen`). The firewall
   in `deploy/README.md` (22/80/443 only) is what keeps port 5000 private.
5. **The cross-host E2E depends on public DNS for `localtest.me`.** CI also pins both names in
   `/etc/hosts`.
6. **Requests rejected while initialization is failing are not request-logged.** The init
   guard runs before the request logger. This predates the phase and is unchanged; the init
   failure itself is logged at `fatal`.
7. **`<DOMAIN>` ends up in the built sitemap/robots** until `SITE_URL` is set in Vercel. The
   build warns every time.

## Fixes after verification

### 1. Node listened on 0.0.0.0, so Nginx could be bypassed (S3)

**The problem.** `server.js` hardcoded `0.0.0.0` while `deploy/nginx/api.conf` and
`deploy/README.md` said Node was on `127.0.0.1:5000`. With `TRUST_PROXY=true`, anyone who could
reach port 5000 directly could send their own `X-Forwarded-For` and evade IP restrictions and
rate limits. This was risk 4 above. I had relied on the firewall alone; it is now fixed in the
code.

**The fix.**
- New `HOST` env var in `src/config/env.js`. Unset means `127.0.0.1` when
  `NODE_ENV=production` and `0.0.0.0` otherwise. A blank value is rejected rather than quietly
  meaning "all interfaces".
- `server.js` uses `env.HOST` and logs it.
- Documented in `backend/.env.production.example` (`HOST=127.0.0.1`, with the reason),
  `backend/.env.example`, `backend/docs/setup.md`, `backend/docs/ARCHITECTURE.md`,
  `deploy/README.md` (firewall step) and the `deploy/nginx/api.conf` header.

**Tests.**
- `tests/unit/listenHost.test.js` (U-58–U-61):
  - S3: production listens on 127.0.0.1 by default, so only Nginx can reach Node
  - S3: development and test listen on 0.0.0.0 by default
  - S3: an explicit HOST wins in every environment
  - S3: a blank HOST is rejected instead of silently meaning "all interfaces"
- `tests/security/listen-address.test.js` (S-09, S-10) starts the **real `server.js`** in
  production and checks:
  - S3: the production server answers on loopback, where Nginx connects
  - S3: the production server refuses connections on the machine's network addresses
- **Proof that S-10 catches the original bug:** with `server.js` temporarily set back to the
  old hardcoded `'0.0.0.0'`, it failed with "port 24524 must not be reachable on 26.199.74.56
  (got connected)". With `env.HOST` it passes.
- `deployConfig.test.js` asserts `HOST=127.0.0.1` in the production template, and that the
  filled-in template resolves to `host: '127.0.0.1'`.

### 2. The addresses are decided (D2)

| Role | Address |
| --- | --- |
| Site (Vercel) | `https://commons.signpak.tech` |
| API (our server) | `https://api.commons.signpak.tech` |

The API is deliberately **not** `api.signpak.tech`, which is kept for the future SignPAK app
backend.

**Checked first:** the Public Suffix List's only matching entry is `tech` itself. So the
registrable domain is `signpak.tech`, and `commons.signpak.tech` / `api.commons.signpak.tech`
are the same site. The host-only `SameSite=Lax` cookie works exactly as the cross-host E2E
test showed.

**Replaced everywhere:** `api.<DOMAIN>` became `api.commons.signpak.tech` and `commons.<DOMAIN>`
became `commons.signpak.tech`, in these files:
- `deploy/` (Nginx config, guide, CI check script)
- `backend/.env.production.example` and `backend/.env.example`
- `backend/docs/{ARCHITECTURE,setup,TEST-CASES}.md`
- frontend `README.md` and `docs/architecture.md`
- the `SITE_URL` default in `seoCatalog.mjs`, the `vite.config.js` comment, and
  `seoCatalog.test.js`
- the e2e config and spec comments, and the review checklist

The following were also changed, beyond the mechanical replacement:
- `.env.production.example`:
  - `CLIENT_ORIGIN=https://commons.signpak.tech`
  - `BREVO_SENDER_EMAIL=no-reply@signpak.tech`, with a comment that `signpak.tech` must be
    authenticated in Brevo first (pointing at the guide's section 1)
  - the "replace every `<DOMAIN>`" instruction removed
- `deploy/README.md`:
  - **section 1 is now "DNS and email authentication"**, with a table of records: `A`, host
    `api.commons` → `<SERVER_IP>`; `CNAME`, host `commons` → what Vercel shows; and the Brevo
    records. A **Brevo domain authentication** step adds the records Brevo shows, then clicks
    Authenticate. It sits inside section 1 rather than in a new section, so the section numbers
    that the config files point at stay valid.
  - a note in the Vercel section to **make `commonssignpak.vercel.app` redirect (308) to
    `commons.signpak.tech` once the API is live**, and only after the section 10 health check
    passes, because until then the old address is the only working copy of the site
  - the placeholder-substitution (`sed`) install step is gone, since the config now names the
    real host
  - the "what to send back" list now asks for the server IP, Cloudflare Tunnel yes/no, and
    Brevo authentication status
  - the Cloudflare Tunnel fallback notes that moving `signpak.tech`'s DNS means recreating the
    Vercel and Brevo records there
- `deploy/scripts/check-nginx.sh` now tests the **unmodified** config with a throwaway
  certificate at `/etc/letsencrypt/live/api.commons.signpak.tech/`, and fails if a `<DOMAIN>`
  placeholder ever reappears.
- **The `SITE_URL` default is now the real site**, so the build warning about a placeholder
  had nothing left to warn about and was removed. `SITE_URL` still overrides it (e.g. for a
  staging deployment). Because the sitemap and robots.txt now name the real site with no Vercel
  setting needed, the checklist's `SITE_URL` leftover is **ticked**.
- `docs/FIX-PLAN.md` section 0: D2 is marked **Decided (20 Nov 2026)** with both addresses, the
  `api.signpak.tech` reservation, the cookie reasoning and the Brevo sender. A mapping table
  (`api.<DOMAIN>` → `api.commons.signpak.tech`, `commons.<DOMAIN>` → `commons.signpak.tech`,
  `<DOMAIN>` → `signpak.tech`) tells readers how to read the later phases, which were written
  with the placeholder. Those phases' text is left as written.

**Tests.** `deployConfig.test.js` (U-56, renamed to "C1: deploy files name
api.commons.signpak.tech and commons.signpak.tech, with no placeholders left") now checks:
- no `<DOMAIN>` remains in `deploy/` or the production template;
- `server_name api.commons.signpak.tech;` is present, and the guide names both https addresses;
- `api.signpak.tech` is **never used as an address** (URL, `server_name`, certificate path or
  env value). The first version of this check also matched the Nginx comment explaining the
  reservation, so it now targets address contexts only.
- the production template sets `CLIENT_ORIGIN=https://commons.signpak.tech` and
  `BREVO_SENDER_EMAIL=no-reply@signpak.tech`, and resolves to
  `clientOrigins: ['https://commons.signpak.tech']`.

`seoCatalog.test.js` FU-21 now asserts the default `https://commons.signpak.tech`.

**Left as they are, deliberately:**
- `docs/phase-reports/PHASE-1.md` above this section, which is the record of what was submitted
  (risks 4 and 7 above are resolved by these fixes)
- `docs/CLAUDE-CODE-KICKOFF.md`, whose one `<DOMAIN>` is the instruction to use placeholders
- the generated (gitignored) `frontend/public/robots.txt`, which now regenerates with the real
  site

`nginx -t` was re-run locally on Nginx 1.24 and 1.27 with the real hostname (both "test is
successful"); shellcheck v0.10.0 is clean on both scripts.

### Test gate after the fixes

Run on this branch, Windows 11, Node v24.13.1, 20 Nov 2026.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 61, pass 61, fail 0 (57 + 4 new) | 0 |
| backend `test:integration` | tests 49, suites 11, pass 49, fail 0 | 0 |
| backend `test:security` | tests 56, suites 4, pass 56, fail 0 (54 + 2 new) | 0 |
| backend `test:coverage` | tests 166, pass 166; 87.82% lines / 85.92% branches; floors passed (`src/services` 78.52% vs floor 78) | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 8 passed (8), Tests 27 passed (27) | 0 |
| frontend `test:coverage` | 18.9% lines; thresholds passed | 0 |
| frontend `build` | built; SEO assets generated for `https://commons.signpak.tech` | 0 |
| `e2e` | 12 passed (1.0 m) | 0 |
| audits | backend 6 (4 high), frontend 2 high | 1 (expected until Phase 3) |

Traceability: 6 new rows (U-58–U-61, S-09, S-10), U-56 renamed; the counts are now 40 files and
205 cases. The traceability test validates every row.

**CI** on `f1a5223`, run
[44796632561](https://github.com/SignPak/SignPakCommons/actions/runs/44796632561): overall
**success**. Backend (pass 61 / 49 / 56; 166 under coverage), frontend, e2e and deploy files all
green; the audit fails as expected. On the Linux runner, S-10 probed the runner's real network
address and was refused immediately (2 ms, no "no non-loopback address" diagnostic), so the
loopback-only bind is proven there too.

### Real-server "done when" — still pending, now with the real addresses

**Blocked on: the server (D1).** The domain is decided.
- [ ] `https://api.commons.signpak.tech/api/v1/health` returns OK with a valid certificate.
- [ ] Sign-up, login and logout work at `https://commons.signpak.tech` in Chrome, Firefox,
  Safari (macOS and iOS) and a private window.
- [ ] A recording of about 90 MB uploads successfully.
- [ ] The server logs show the real visitor IPs (`clientIp`), not 127.0.0.1.

New prerequisites before those checks, both from `deploy/README.md` section 1:
- the DNS records: `A api.commons`, `CNAME commons`, and the Brevo records;
- `signpak.tech` authenticated in Brevo.

Once the API is live, `commonssignpak.vercel.app` should be set to redirect to
`commons.signpak.tech` (section 11).

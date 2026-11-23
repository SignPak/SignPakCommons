# Phase 10 – Docs, SRS sync and final check

## Phase and branch

| | |
| --- | --- |
| Phase | 10 – Docs, SRS sync and final check (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-10-docs-final` (from `main` @ `1798365`, Phase 9 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.15 → 1.0.16`, frontend `1.0.17 → 1.0.18` |

## FIX-PLAN items

| Item | Status | Summary |
| --- | --- | --- |
| 1. Docs, READMEs and OpenAPI for every route and env variable | **Done** | The OpenAPI spec already had every route; six env variables were missing from the `.env` examples or `setup.md` and are now there. Two new tests keep it that way. Stale text fixed. |
| 2. CHANGELOG | **Done** | `CHANGELOG.md`, one entry per phase with both versions. |
| 3. SRS follow-ups (done by the team in Word) | **List written** | `docs/SRS-CHANGES.md`: everything you listed, plus what else Phases 0–9 changed. The edits themselves are the team's. |
| 4. Playwright for every automatable checklist line, and `@smoke` | **Done; production run pending** | Four new specs; `npm run e2e:smoke -- --base-url=…`, proven locally. Production isn't live yet, so the run against it is pending. |
| 5. Final check of `TEST-CASES.md` | **Done** | Every FR13.1–FR13.13 and every checklist ID has a test, and a new test fails if one ever doesn't. |
| 6. Manual checklist on production | **Pending (team)** | The table below, to be run on the live site. |

**Review checklist:** no item changes state in this phase. One item stays open, as before: D3's
team action, setting the Google OAuth consent screen to *In production* and creating a new
refresh token.

## Your decisions

1. **Coverage:** `src/utils` and `src/services` go to 80% lines, every floor is raised to what is
   reached, and the 70% overall target is reported as not met.
2. **Smoke:** I build it and prove it locally, then also run it against production.
3. **Manual production checklist:** hand off with it pending; your results go in as a fix after
   verification.

## What changed

### 1. SRS change list: `docs/SRS-CHANGES.md` (new)

There is no SRS in the repo, so each entry gives the SRS place, what the system does now (with
the file that shows it), and suggested wording. Status: **to do (team)**.

| SRS place | Change |
| --- | --- |
| Figure 5, §3.3.4 | The API runs on the team's VPS (Node 22, PM2, Nginx, Let's Encrypt) at `api.commons.signpak.tech`; the site is on Vercel at `commons.signpak.tech`. Not Railway, no Vercel backend. One site, so the host-only `SameSite=Lax` cookie works. |
| Table 15 | Google Drive OAuth refresh token (used), next to the service account (alternative), with the variables. |
| Table 17 | Every direct dependency with its range and installed version, from the lockfiles; Node 22; what was removed. |
| FR13.13 | The self-delete sentence you asked for (the account goes, recordings stay until a deletion request, as the consent notice says); the emailed code for signed-out requests; the admin deletion tools. |
| FR13.12, roles | Personal admin accounts (`ADMIN_EMAILS`), the activity log, the admin tabs. |
| SE-x | Lockout 5 / 15 min, sessions ended on logout and password change, 10-minute codes, 24-hour sign-up expiry, the CSP, `X-Request-Id`. |
| Data and ML | The CSV/JSON export (no names or emails), `prepare-dataset.js`, the 100 MB limit and the accepted formats. |
| Other | Contact limits, per-browser notifications, lazy pages, the WCAG 2.1 AA checks. |
| §9 | `TEST-CASES.md` as the traceability table, with the final counts. |

### 2. Docs

- **Env gaps:**
  - `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON` are added, commented, to
    both `.env` examples.
  - `MONGODB_URI`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` and `BREVO_SENDER_NAME` are added to the
    env tables in `setup.md`.
  - `.env.example`'s sender was `auth@signpakcommons.org`, an address from before D2; it is now
    `no-reply@signpak.tech`.
- **Stale text:**
  - `frontend/README.md` and `frontend/docs/architecture.md` still said the ffmpeg core comes from
    jsDelivr (Phase 9 moved it to `/ffmpeg/`).
  - `frontend/docs/MODULE-REFERENCE.md` gains rows for the lazy pages, the error boundary and
    chunk reload, the security headers and bundle check, and the export link.
  - A grep for removed things (react-snap, `blobStore`, jsDelivr, `toBlobURL`, Railway, the
    `.example` domains, "5 minutes" for codes) finds nothing else stale.
- **New:**
  - `CHANGELOG.md`;
  - a Documentation section in the root `README.md`;
  - `e2e/README.md`: the new specs, the production checklist with what covers each line, and
    "Smoke against production".

### 3. Docs-sync tests (`backend/tests/unit/docsSync.test.js`, new)

- **`Docs: every API route is in the OpenAPI spec`** compares the router stack
  (`tests/support/routeInventory.js`, as the access matrix does) with `openapi.paths`. Only `/`,
  `/favicon.ico` and the spec's own two URLs are exempt, on a commented list.
- **`Docs: every environment variable is in .env.example, .env.production.example and
  setup.md`** reads the keys of the Zod schema in `env.js`. `E2E_TEST_HOOKS` is kept out of the
  production example on purpose.
- **Failing first:** run before the env fixes, it failed on exactly the eight gaps above, and the
  route test on `/docs.json` (now on the exempt list, since it is the spec itself).

### 4. Traceability guard

`traceability.test.js` gains `every FR13.x requirement and every checklist ID has at least one
test` (FR13.1–FR13.13, C1–C5, S1–S10, B1–B8). Today every ID has a test. To check that the guard
works, I removed the B6 rows from a scratch copy of the table: it failed with `B6`. The table was
then restored.

### 5. E2E for the production checklist, and `@smoke`

| Spec | What | Engines |
| --- | --- | --- |
| `record-submit.spec.js` | Record with the fake camera, trim to 0.5 s and confirm, mirror (the preview flips), submit. The cooldown shows the seconds left; when it runs out the same video is recorded and submitted again. Through the admin API, the first take has `trimStart` 0.5 and `mirrored: true`. | Chromium (fake camera; a planned skip elsewhere, like E-19) |
| `account-controls.spec.js` | An admin suspends a contributor in Admin → Users. Their open session's submit gets 401 "This account is suspended.", and the login form says the same. Reactivate, and login works. An admin restricts the contributor's device ID: the next page load's API call gets 403 with the reason. Remove it, and the library loads. Cleanup in `finally`. | all three |
| `upload-limit.spec.js` | A ~101 MB recording gets 413 "That file is too large." (`PAYLOAD_TOO_LARGE`); a 90 MB one is accepted (201). Through the site's `/api` proxy with the contributor's session. | Chromium only (API-level) |
| `smoke.spec.js` (`@smoke`) | The landing page with its security headers; log in and see the library; the profile shows the account, and Log out ends the session. Read-only. | all three |

- **Shared helpers** in `support/flows.js`: `ADMIN`, `tinyWebm`, `apiSession`, `publishedVideo`
  and `logInThroughUi` (which waits for the login heading, the lesson from Phase 9).
- **One cooldown for the run:**
  - `SUBMISSION_COOLDOWN_MS` (5 s) in `playwright.config.js` goes to the API and to both site
    builds (`VITE_SUBMISSION_COOLDOWN_MS`).
  - Before this, the E2E API enforced 2 s while the site counted down 30 s. No earlier spec
    submits twice to one video, so none depended on it.
- **The smoke run:**
  - `npm run e2e:smoke -- --base-url=<url>` (`e2e/scripts/smoke.js`) loads `SMOKE_EMAIL` and
    `SMOKE_PASSWORD` from the environment or a gitignored `e2e/.env.smoke`.
  - For a non-local URL it refuses to start without them (exit 2, checked), so it can't add
    failed logins toward a lockout.
  - It runs `playwright.smoke.config.js`, which has no retries and starts the local servers only
    for a local URL.
  - Locally it signs in as `smoke@signpak.test`, which the E2E API seeds (the E2E server only
    runs under `NODE_ENV=test`).
- **IP restrictions** are left to the API test I-45 and the manual list: every spec runs from
  127.0.0.1, so restricting it would block the shared E2E server for the other specs.

### 6. Frontend coverage

| | Before | After |
| --- | --- | --- |
| Lines (overall) | 45.58% | **55.19%** |
| Statements / branches / functions | 43.58% / 40.59% / 39.87% | 52.98% / 48.33% / 51.40% |
| `src/services` lines | 38.9% | **98.6%** |
| `src/utils` lines | 77.2% | **98.3%** |

- **`test/integration/apiClient.test.js`** (74 cases) covers the real API client with only the
  network mocked. It is an integration test because `frontend/AGENTS.md` keeps MSW out of unit
  tests; the plan said `test/unit`. It checks:
  - every `api.*` call's method, path and body;
  - the device ID;
  - input validation before sending;
  - the response and error envelopes;
  - the public-stats cache;
  - the form uploads, the XHR background upload (progress, errors, cancelling) and the video
    download;
  - the browser-only notifications.
- **Two stand-ins.** jsDom's `FormData` can't be read back by MSW, so the form tests read the
  `FormData` the client hands to `fetch`. The background upload uses a small fake
  `XMLHttpRequest`, which also lets the test fire progress events.
- **`test/unit/utilsCoverage.test.js`** (16 cases) covers `media`, `validators`, `format` and the
  video cache's sharing, expiry, budget and prefetch.
- **The floors in `vite.config.js`** are raised to the reached figures, rounded down:
  - overall: 55 / 52 / 51 / 48;
  - `src/utils`: 98 / 94 / 93 / 80;
  - `src/services`: 98 / 97 / 98 / 91.
- **70% overall is not met.** Pages, contexts and hooks are the rest; see "Not done".

## Tests

All new tests are named with their requirement.

| Level | File | Rows |
| --- | --- | --- |
| Backend unit | `docsSync.test.js` (2), `traceability.test.js` (+1) | U-210–U-212 |
| Frontend unit | `utilsCoverage.test.js` | FU-79–FU-94 |
| Frontend integration | `apiClient.test.js` (31 tests + one `it.each` of 43 calls) | FI-46–FI-77 |
| E2E | `record-submit`, `account-controls`, `upload-limit`, `smoke` | E-25–E-31 |

- **Failing first:**
  - the docs-sync tests on the eight env gaps;
  - the traceability guard against a table missing B6.
  - The E2E specs cover behaviour that already worked, so they passed at once, except smoke's
    first run. It found two "Log out" buttons on the profile ("Log out" and "Log out of all
    devices"), so the test now matches the name exactly. It must never press the second against
    production.
- **No existing test was changed, deleted, skipped or weakened.**
  - `traceability.test.js` gains the guard and three no-requirement notes (documentation, API
    client, frontend helpers), also in the `TEST-CASES.md` legend.
  - `playwright.config.js` gains the shared cooldown and passes it on.
  - `e2e-server.js` seeds the smoke contributor.
- **`TEST-CASES.md`** lists **113 files and 766 cases**. Its §7 now records the final check.

## Test gate results

| Gate | Result |
| --- | --- |
| Backend `test:unit` | 212 passed, 0 failed, 0 skipped |
| Backend `test:integration` | 162 passed, 0 failed, 0 skipped |
| Backend `test:security` | 81 passed, 0 failed, 0 skipped |
| Backend `test:coverage` | 455 passed; 94.67% lines, 90.34% branches (floors 85% / 75%); services 90.81% / 89.18%, middlewares 98.38% / 88.16%, utils 99.48% / 93.96% (floors 80% / 75%), unchanged |
| Frontend `lint` | clean |
| Frontend `test` | 218 passed (28 files) |
| Frontend `test:coverage` | 55.19% lines, 52.98% statements, 48.33% branches, 51.40% functions; new floors met |
| Frontend `build` + `check:bundle` | main chunk 268.95 kB (limit 300 kB) |
| E2E | 87 passed, 6 skipped (Chromium-only by design: the editor's axe check, the record flow and the upload limit), 3 engines, all under the CSP |
| Local smoke (`npm run e2e:smoke -- --base-url=http://127.0.0.1:4173`) | 9 passed (3 tests × 3 engines) |
| `npm audit --omit=dev --audit-level=high` | backend 0, frontend 0, e2e 0 |

### CI

The CI runs for the last commit are given in the hand-off message and in a PR comment.

## Smoke run against production

**Pending: production is not live yet** (your answer when the local gate was green). The subset
is ready and proven locally (9 passed). When the site is deployed:

1. Create a normal contributor account on the live site and accept the consent notice.
2. Put `SMOKE_EMAIL=…` and `SMOKE_PASSWORD=…` in `e2e/.env.smoke` (gitignored).
3. Run `cd e2e && npm run e2e:smoke -- --base-url=https://commons.signpak.tech`.

I'll record the result here as a fix after verification.

## Manual checklist on production (FIX-PLAN §10.6), to be run by the team

Mark each line and send me the results; I'll record them here as a fix after verification.

| # | Check | Automated locally by | Result |
| --- | --- | --- | --- |
| 1 | Sign-up → code (10 min) → consent → library, on Chrome, Safari iOS and Android Chrome | `signup.spec.js` (3 engines) | ☐ |
| 2 | Wrong password 5 times → locked; works again after 15 minutes | `account-security.spec.js` (S2) | ☐ |
| 3 | Forgot password → code → reset; old sessions are logged out | `account-security.spec.js` (S6) | ☐ |
| 4 | Record, trim, mirror and submit; the cooldown shows the time left; a second submit after 30 s works | `record-submit.spec.js` | ☐ |
| 5 | A recording of about 90 MB uploads; one over 100 MB is refused with a reason | `upload-limit.spec.js` | ☐ |
| 6 | Suspended user: can't log in or submit | `account-controls.spec.js` | ☐ |
| 7 | IP/device restriction blocks access, and the admin can remove it | `account-controls.spec.js` (device), I-45 (IP) | ☐ |
| 8 | Signed-in contact message arrives; a signed-out deletion request → emailed code → "verified" in Admin → Messages | `contact.spec.js` | ☐ |
| 9 | Admin deletes a contributor's recordings → files gone from Drive, the count is 0, and it appears in Admin → Activity | `admin-deletion.spec.js`, `admin-activity.spec.js` | ☐ |
| 10 | Each team member logs in with their own admin account | `admin-activity.spec.js` | ☐ |
| 11 | CSV export opens with correct trim and mirror values; `prepare-dataset.js` produces trimmed clips | `admin-export.spec.js`, the dataset script tests | ☐ |
| 12 | `uploads/tmp` on the server is empty after the uploads | backend C5 tests | ☐ |
| 13 | `npm audit --omit=dev` shows 0 high issues; CI is green on `main` | CI | ☐ |

**Also pending from earlier phases (on the server):**
- the Brevo deletion email;
- real IPs in the logs;
- `EMAIL_HASH_SECRET` and `ADMIN_EMAILS` set;
- `/ffmpeg/ffmpeg-core.wasm` returning 200 on Vercel;
- the D3 consent screen.

## How to verify by hand

1. **`docs/SRS-CHANGES.md`:** read it against the SRS; each entry names the file that backs it.
2. **Docs-sync tests:** in `backend/`, `node --test tests/unit/docsSync.test.js`. Delete a row
   from the env table in `docs/setup.md` (scratch copy) and the test names the variable.
3. **Smoke, locally:** in `e2e/`, `npm run e2e:smoke -- --base-url=http://127.0.0.1:4173`.
   - `npm run e2e:smoke -- --base-url=https://example.org` with no credentials refuses to start.
4. **Coverage:** in `frontend/`, `npm run test:coverage`; the new floors are in `vite.config.js`.

## Not done, and deviations from the plan

1. **70% overall frontend coverage is not met** (decision 1). It is 55.19%; the rest is pages
   (51%), contexts (36%), hooks (0%) and components (37%). `src/utils` and `src/services` are
   past 80%.
2. **The API-client tests are in `test/integration/`,** not `test/unit/` as planned, because
   `frontend/AGENTS.md` keeps MSW in integration tests.
3. **IP restrictions in E2E:** device restrictions only, for the reason above. The API test I-45
   covers IP restrictions.
4. **The SRS itself is not edited here.** `docs/SRS-CHANGES.md` is the list for the team; its
   wording was written without the SRS text, so each entry needs checking against the document.

## Known risks

1. **The smoke account** is a real production account. It needs a strong password and should be
   left out of exports and counts as the team sees fit. Its credentials stay in `e2e/.env.smoke`
   (gitignored) or the shell, never in git.
2. **The 90 MB upload spec** adds about 190 MB of local traffic to the E2E job. It runs in one
   engine, against the local storage driver.
3. **The raised frontend floors are tight** (rounded down from today's figures). A change that
   removes tested code or adds untested code to `src/utils` or `src/services` will need tests to
   pass the gate, which is the point.

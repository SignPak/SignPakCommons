# SignPakCommons – implementation plan for Claude Code

This plan covers every item in `docs/SignPakCommons review checklist.md` (IDs C1–C5, S1–S10, B1–B8). The checklist describes each problem; this plan says how to fix it. All design decisions are already made (section 0), so Claude Code should follow them and not choose differently.

The work is split into Phases 0–10. Each phase is one branch and one pull request, with its own tests and "done when" list. Work through the phases in order.

Repo: https://github.com/SignPak/SignPakCommons (base commit `b10d90b`).

---

## 0. Decisions (settled – do not change)

| # | Topic | Decision | What it means for the code |
| --- | --- | --- | --- |
| D1 | Backend host | A self-hosted Linux server: a **Hostinger VPS** or the **university GPU server**. Final choice pending, so the setup must work on both. | Run Node 22 behind **Nginx** with HTTPS (Let's Encrypt), kept alive by **PM2** (one process, fork mode). Add the deployment files to `deploy/`. No Vercel or Railway-specific code. |
| D2 | Domain | **Decided (20 Nov 2026):** the team's domain is `signpak.tech`. Site at **`commons.signpak.tech`** (Vercel), API at **`api.commons.signpak.tech`** (the server). The API is deliberately **not** `api.signpak.tech`: that name is kept for the future SignPAK app backend. | Both are hosts of one site (`signpak.tech`; checked against the Public Suffix List), so the login cookie works as `SameSite=Lax`, host-only (no `COOKIE_DOMAIN` needed). `CLIENT_ORIGIN=https://commons.signpak.tech`, `VITE_API_ORIGIN=https://api.commons.signpak.tech`, `SITE_URL=https://commons.signpak.tech`. Email is sent as `no-reply@signpak.tech`, so `signpak.tech` must be authenticated in Brevo. |
| D3 | Google Drive sign-in | Keep the current OAuth refresh token. | The team sets the Google Cloud OAuth consent screen to **In production**, because "Testing" tokens expire every 7 days. The code only adds a clear log message when the token stops working. |
| D4 | Verifying deletion requests | **Emailed 6-digit code.** | A signed-out deletion request sends a code to the account's email; the request shows as "verified" once the code is entered. Requests from signed-in contributors are verified straight away. Requests for an email with no account stay "unverified" and are checked by hand. |
| D5 | Admins | **Separate admin accounts for each team member, plus an activity log.** | Add `ADMIN_EMAILS` (comma-separated). Team members sign up normally; at startup the accounts on the list become admins, and admins not on the list (other than `ADMIN_EMAIL`) go back to normal users. Every admin action is written to an `AuditLog`. |

Smaller choices, also settled:

| Topic | Value |
| --- | --- |
| Email code expiry | **10 minutes** (`AUTH_OTP_TTL_MINUTES=10`), matching the SRS. Resend after 60 s. |
| Account lockout | 5 wrong passwords → locked for 15 minutes. |
| Unfinished sign-ups | Deleted 24 hours after creation if the email was never verified. |
| Contact limits | Signed-in: 1 general/partnership message a day; deletion requests don't count. Signed-out: 2 deletion requests a day per IP/device. Site-wide cap stays at 25 a day but never blocks anyone. |
| 3GP and audio-only files | Rejected. Only WebM, MP4 and MOV video are accepted. |
| User ID in the ML export | The raw MongoDB user ID (it doesn't contain any personal detail). No names or emails in the export. |
| Browser notifications | Keep them in the browser only, and document that they are per device. |
| Upload limit | 100 MB. If the API is ever put behind Cloudflare (its free plan caps request bodies at 100 MB), set `MAX_RECORDING_UPLOAD_MB=95`. |

Values the team fills in at deploy time (they don't change the code): the server's IP address, and the secrets in `backend/.env`.

**Reading `<DOMAIN>` in the rest of this plan.** The phases below were written before D2 was decided and still say `<DOMAIN>`. Read them with this mapping (applied in the code, config and docs since Phase 1):

| Written below | Means |
| --- | --- |
| `api.<DOMAIN>` | `api.commons.signpak.tech` |
| `commons.<DOMAIN>` | `commons.signpak.tech` |
| `<DOMAIN>` alone | `signpak.tech` |

---

## 1. Rules for Claude Code

1. Read `backend/AGENTS.md`, `frontend/AGENTS.md`, `backend/docs/ARCHITECTURE.md` and `frontend/docs/architecture.md` first, and follow the existing layering: routes → validators (Zod) → controllers → services → repositories → models.
2. Use one branch per phase (`fix/phase-N-<name>`) and one pull request per phase. Never commit straight to `main`.
3. Start every phase in plan mode: show the plan, wait for approval, then write the code.
4. Follow the decisions in section 0. If something in the code makes a decision impossible, stop and ask; don't pick an alternative.
5. Keep the API response shape (`{ data }` / `{ error: { code, message, fields } }`) and the existing routes. Add routes; don't rename them.
6. Follow the testing strategy in section 4 for every change: unit tests, integration tests, and E2E tests where a user flow changes. Every checklist item gets at least one regression test whose name starts with its ID (for example `C5: removes the temp file after a Drive upload`).
7. Before saying a phase is done, run the full test gate (section 4.6) and make sure everything passes and coverage stays at or above the thresholds.
8. Never commit `.env` files, keys or tokens. Add new environment variables to `backend/.env.example` and the env tables in `backend/docs/setup.md`, and add them to the Zod schema in `backend/src/config/env.js`.
9. Update the docs a change touches: `docs/API.md`, `docs/MODULE-REFERENCE.md`, `docs/TEST-CASES.md` and the OpenAPI spec in `src/docs/openapi.js`.
10. Bump the version in `package.json` (backend and/or frontend) once per phase, the same way the earlier commits did.
11. Don't change features that already work (FR13.1–FR13.12) unless the phase says to.
12. After finishing a phase, tick the matching items in `docs/SignPakCommons review checklist.md`.
13. **Stop after every phase.** Write the phase report (section 5), commit everything to the phase branch, push the branch, open the PR, and wait. Don't start the next phase, and don't merge, until I say the phase has been verified.
14. Work only in this repo folder, and leave no uncommitted changes at the end of a phase, so the phase can be checked from the branch alone.

---

## 2. Kickoff prompt

The full kickoff prompt is in `docs/CLAUDE-CODE-KICKOFF.md`. Paste it into Claude Code once, at the start.

## 3. Prompts during the work

**Start the next phase** (only after the previous one is verified and merged):

```
Phase N-1 is verified and merged. Pull main, then start Phase N from
docs/FIX-PLAN.md on the branch fix/phase-N-<name>. Plan mode first, and wait
for my approval.
```

**Fix the issues found in verification:**

```
Verification of Phase N found these issues: <paste the list>.
Fix them on the same branch, add or adjust tests for each one, re-run the
full test gate, update docs/phase-reports/PHASE-N.md (add a "Fixes after
verification" section), push, and stop again.
```

---

## 4. Testing strategy (applies to every phase)

The project must have unit, integration and end-to-end tests, organised so each kind can run on its own. Phase 0 sets this up; every later phase adds tests at all the levels its changes touch.

### 4.1 Layout

| Level | Backend | Frontend | Tool |
| --- | --- | --- | --- |
| Unit | `backend/tests/unit/` | `frontend/test/unit/` | node:test (backend), Vitest + Testing Library (frontend) |
| Integration | `backend/tests/integration/` | `frontend/test/integration/` | node:test + the real Express app + mongodb-memory-server (backend); Vitest + MSW for page-level tests with a mocked API (frontend) |
| End-to-end | `e2e/` at the repo root (its own `package.json`) | – | Playwright (Chromium, Firefox, WebKit) |
| Security | `backend/tests/security/` | – | node:test |

The existing tests move into this layout in Phase 0:
- `api-*.test.js` go to `integration/`.
- `safeName`, `localStorage` and `videoService` go to `unit/`.
- `apiContext.js` and `helpers.js` stay as shared helpers in `tests/support/`.

### 4.2 Unit tests

- **What they cover:** single functions and modules with their dependencies faked. Use `node:test` `mock`, fake repositories and a fake storage driver.
- **Backend examples:** utils (`files.js`, `sendFile.js`, `tokens.js`), validators (each Zod schema, valid and invalid), services (`authService`, `submissionService`, `contactService`, `userService`, `storageService`) with fake repositories, and middlewares (`authenticate`, `requireRole`, `verifyOrigin`, `validate`, `errorHandler`).
- **Frontend examples:** utils (`limits`, `validators`, `authSchemas`, `consent`, `format`), hooks (`useRecorder` with a mocked MediaRecorder), and single components (`RecorderPanel`, `TrimSlider`, `Field`, `ContactForm`).
- **Speed:** no network and no database. The whole unit suite should run in seconds.

### 4.3 Integration tests

- **Backend:**
  - HTTP requests against the real Express app, with MongoDB in memory, the local storage driver in a temp folder, a **fake Drive driver** (same interface as `googleDriveDriver`, keeps files in memory, can be told to fail), and fake Brevo/Web3Forms senders that record what they would have sent.
  - Cover each route's success path, validation errors, 401/403/404/409/413/429 cases, and side effects (DB documents, stored files, emails "sent").
- **Frontend:** render whole pages with the router and providers, with the API mocked by **MSW** (add `msw` as a dev dependency). Cover:
  - login/signup/verify/consent
  - library → player → editor → submit (queue)
  - the contact form and verify page
  - the admin pages

### 4.4 End-to-end tests (Playwright)

- **Setup:**
  - `e2e/` starts the backend in test mode, with in-memory MongoDB, local storage and `EMAIL_DRIVER=capture`, plus the built frontend (`vite preview`).
  - The camera is faked with Chromium's `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`; Firefox and WebKit run the flows that don't need the camera.
- **Reading email codes in tests:**
  - Add a test-only route `GET /__test/emails?to=` that returns captured codes.
  - It is registered only when `NODE_ENV=test` **and** `E2E_TEST_HOOKS=true`.
  - `env.js` must refuse to start if `E2E_TEST_HOOKS=true` in production, and a security test proves the route doesn't exist otherwise.
- **Flows to cover** (added in the phase that builds each one):
  - sign-up → code → consent → library
  - login/logout and the login lockout
  - forgot password
  - record → trim → mirror → submit → cooldown message
  - admin uploads a reference video and publishes it
  - contact message
  - signed-out deletion request → code → verified
  - admin deletes a contributor's recordings
  - each admin sees the activity log
  - CSV export download
- **Cookies:** one test runs the API and the site on two different hostnames that share a parent domain (for example `api.localtest.me` and `commons.localtest.me`). It proves the login cookie works across them in WebKit (Safari's engine).

### 4.5 Security tests

- **Access matrix:** a table-driven test that calls every route as anonymous, contributor, suspended contributor and admin, and checks the expected status code. It fails if a new route is added without an entry, so new routes can't skip access control.
- **Checks:** cross-origin write rejected, tampered and expired JWT rejected, old JWT rejected after logout or password change, NoSQL-style payloads (`{"$gt":""}`) rejected by validation, oversized bodies → 413, wrong file types rejected, rate limits (with `RATE_LIMIT_ENABLED=true`), and no `detail` field in production errors.

### 4.6 Test gate and coverage

Scripts (added in Phase 0):

| Where | Script | What it runs |
| --- | --- | --- |
| backend | `npm run test:unit` | unit tests |
| backend | `npm run test:integration` | integration tests |
| backend | `npm run test:security` | security tests |
| backend | `npm test` | all of the above |
| backend | `npm run test:coverage` | all, with coverage (c8) and thresholds |
| frontend | `npm run lint` | ESLint |
| frontend | `npm test` | unit + integration (Vitest) |
| frontend | `npm run test:coverage` | with `@vitest/coverage-v8` and thresholds |
| frontend | `npm run build` | production build |
| e2e | `npm run e2e` | Playwright, all browsers |
| both | `npm audit --omit=dev --audit-level=high` | no high vulnerabilities |

Coverage thresholds:
- **Backend:** at least 80% lines and 75% branches for `src/services`, `src/middlewares` and `src/utils`, and at least 75% lines overall.
- **Frontend:** at least 70% lines overall, and at least 80% for `src/utils` and `src/services`.
- Thresholds may only go up.

**Full test gate:** every row in the table above passes. CI runs the same gate on every push and pull request, with separate jobs: backend, frontend, e2e and audit.

### 4.7 Traceability

Keep `backend/docs/TEST-CASES.md` as a table: test ID → test file → requirement (FR13.x, OR-19, SE-x) → checklist ID → level (unit/integration/E2E/security). This table can go straight into Section 9 of the SRS/final report.

---

## 5. Phase completion and verification

Every phase ends the same way:

1. Claude Code runs the full test gate (4.6).
2. Claude Code writes `docs/phase-reports/PHASE-N.md` using this template:
   - **Phase and branch:** name, branch, last commit hash, PR link.
   - **Checklist items done:** the IDs, each with one line on how it was fixed.
   - **Files changed:** grouped into backend, frontend, e2e, deploy and docs.
   - **New routes, models and environment variables.**
   - **Tests added:** file and test names, grouped by level (unit / integration / E2E / security).
   - **Test gate results:** pass/fail counts for each script, and the coverage numbers (lines/branches) before and after.
   - **How to verify by hand:** short steps.
   - **Not done or deviations from the plan:** with reasons. Anything changed from section 0 must be listed here.
   - **Known risks.**
3. Claude Code commits, pushes the branch, opens the PR, and **stops**.
4. I tell the reviewer (Claude in the SignPak project chat) "Phase N done".
5. The reviewer checks the branch from the repo folder, in a separate copy, without touching the working copy:
   - reads the phase report and the diff, and compares them against this plan and section 0
   - runs the test gate
   - checks that every checklist item in the phase has a regression test
   - looks for new security problems
6. The reviewer returns a verification result: **pass**, or a numbered list of issues.
7. If there are issues, Claude Code fixes them on the same branch (prompt in section 3), and steps 1–6 repeat.
8. Only after a pass: merge the PR into `main`, then start the next phase.

---

## Phase 0 – Baseline and test infrastructure (no feature changes)

**Goal:** a working local setup, the full testing setup from section 4, and a green baseline. No app behaviour changes in this phase.

1. `npm ci` in `backend/` and `frontend/`. The first backend test run downloads a MongoDB binary of about 80 MB, which can be slow. Record the current results first.
2. Add a `.nvmrc` (Node 22) at the repo root.
3. **Backend tests:**
   - Move the tests into `tests/unit`, `tests/integration`, `tests/security` and `tests/support` (4.1).
   - Add the scripts from 4.6 and c8 coverage with the thresholds. If the current coverage is below a threshold, set the threshold to the current number, note it in the report, and raise it in later phases.
4. **Fake Drive driver** in `tests/support/fakeDriveDriver.js`, with the same interface as `googleDriveDriver`. It stores files in memory and can be told to fail on save, stat or remove.
5. **Email capture:**
   - Add `EMAIL_DRIVER=brevo|capture` (default `brevo`; tests use `capture`), so Brevo is behind a small interface.
   - The capture driver keeps sent codes in memory.
   - Add the test-only `/__test/emails` route with the production guard from 4.4.
6. **Access matrix test** (4.5) covering every route that exists today.
7. **Frontend tests:**
   - Add MSW and `@vitest/coverage-v8`, and the scripts and thresholds from 4.6.
   - Move the existing tests into `test/unit` and `test/integration`.
   - Add one integration test for the login page using MSW, to prove the setup works.
8. **Playwright** in `e2e/`:
   - Config for Chromium, Firefox and WebKit, with the fake camera flags for Chromium.
   - A global setup that starts the backend (test mode + in-memory MongoDB + capture email + local storage) and `vite preview`.
   - Two smoke tests to start with: the landing page loads, and sign-up → code → consent → library.
9. **CI** (`.github/workflows/`): run on `push` and `pull_request` with jobs for backend (unit, integration, security, coverage), frontend (lint, test, coverage, build), e2e (Playwright with browsers installed, upload the report on failure) and audit (`--audit-level=high`). The audit job may be allowed to fail until Phase 3 fixes the packages; say so in the workflow.
10. Create `backend/docs/TEST-CASES.md` in the traceability format (4.7) for the existing tests.
11. Write `docs/phase-reports/PHASE-0.md`.

Done when:
- [ ] The full test gate passes locally (audit may fail until Phase 3).
- [ ] CI is green on the branch.
- [ ] Coverage numbers are recorded.
- [ ] The existing tests all still pass in their new places.

---

## Phase 1 – Server deployment, domain and sessions (C1, C4, S3, S5)

**Goal:** the API runs on our own server at `https://api.<DOMAIN>`, the site runs at `https://commons.<DOMAIN>`, and login works everywhere, including Safari/iOS.

Code changes:
1. **S5:** in `src/services/initialization.js`, include `detail` in the 503 response only when `!env.isProduction`.
2. Log a clear startup warning when `isProduction && !TRUST_PROXY`.
3. `/api/v1/health` also reports whether storage initialized (true/false only, no secrets).
4. `server.js`: remove the Vercel handler comment and export, keep the plain `app.listen`, and add graceful shutdown on `SIGTERM`/`SIGINT` (stop accepting requests, close MongoDB).
5. Replace `SITE_URL` in `frontend/src/seo/seoCatalog.mjs` with `https://commons.<DOMAIN>`. Make it read from an environment variable (`SITE_URL`) with that default.
6. Update `backend/.env.example` with the production values: `NODE_ENV=production`, `TRUST_PROXY=true`, `CLIENT_ORIGIN=https://commons.<DOMAIN>`, `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`, `STORAGE_DRIVER=gdrive`, `ARCHIVE_STORAGE_DRIVER=gdrive`, `AUTH_OTP_TTL_MINUTES=10`.

New deployment files in `deploy/` (written by Claude Code, used by the team on the server):
1. `deploy/nginx/api.conf`:
   - Server block for `api.<DOMAIN>` with HTTP → HTTPS redirect and Let's Encrypt (certbot) paths.
   - `client_max_body_size 110m;`
   - `proxy_request_buffering off;`
   - `proxy_read_timeout 300s;` and `proxy_send_timeout 300s;`
   - Forwarding headers: `X-Forwarded-For`, `X-Forwarded-Proto`, `Host`.
   - `proxy_pass http://127.0.0.1:5000;`
   - No caching of `/api/`.
2. `deploy/ecosystem.config.cjs` for PM2:
   - one instance in fork mode (the rate limits are kept in memory)
   - restart on crash
   - `max_memory_restart` set to a sensible limit
   - logs in `/var/log/signpakcommons/`
3. `deploy/deploy.sh`: `git pull` → `npm ci --omit=dev` in `backend/` → `pm2 reload` → call `/api/v1/health` and fail if it isn't OK.
4. `deploy/README.md`, a step-by-step server guide that works for both a Hostinger VPS and the university server:
   - install Node 22, Nginx, PM2 and certbot
   - firewall: allow only 22, 80 and 443
   - create a non-root user
   - clone the repo and create `backend/.env` (permissions 600)
   - run certbot for `api.<DOMAIN>`
   - log rotation (`pm2-logrotate`) and starting PM2 on boot (`pm2 startup`)
   - DNS: an `A` record for `api.<DOMAIN>` pointing to the server IP, and `commons.<DOMAIN>` added as a custom domain in Vercel (CNAME as Vercel shows)
   - Vercel environment variable `VITE_API_ORIGIN=https://api.<DOMAIN>`
   - MongoDB: keep the existing MongoDB Atlas database and allow the server's IP in Atlas Network Access
   - **University server note:** it needs a public IP with ports 80/443 open, or the university IT has to forward them. If neither is possible, the guide explains Cloudflare Tunnel as a fallback (then `MAX_RECORDING_UPLOAD_MB=95`).

Tests:
- Unit: production mode hides `detail` in the 503 response; the startup warning appears when `TRUST_PROXY` is off in production.
- Integration: health reports storage status; with `TRUST_PROXY=true`, `req.ip` comes from `X-Forwarded-For`.
- Security: the error-detail check from 4.5.
- E2E: the cross-hostname cookie test from 4.4 (WebKit included).
- Deploy check: `nginx -t` passes on `deploy/nginx/api.conf`, run in a Docker `nginx` container in CI.

Done when (on the real server):
- [ ] `https://api.<DOMAIN>/api/v1/health` returns OK with a valid certificate.
- [ ] Sign-up, login and logout work in Chrome, Firefox, Safari (macOS and iOS) and a private window.
- [ ] A recording of about 90 MB uploads successfully.
- [ ] The server logs show the real visitor IPs, not 127.0.0.1.

---

## Phase 2 – Storage reliability (C5, B1, B6, B8, D3)

**Goal:** no disk leaks, no stuck cooldowns, and only real videos accepted.

1. **C5 temp-file leak:** in `src/services/storage/index.js`, delete `tempPath` with `removeQuietly` in a `finally` block in both `save()` and `archive()`. This is safe for the local driver too, because `removeQuietly` ignores a file that has already been moved.
2. **Startup clean-up:** delete files in `uploads/tmp` older than 1 hour (in the local driver's `init()`).
3. **B1 clean-up order** in `submissionService.create`, `videoService.create` and `demoVideoService.upload`:
   - Wrap each clean-up step (`storageService.remove`, `releaseCooldown`) in its own `try/catch`, log any failure, and always rethrow the original error.
   - Always release the cooldown, even when removing the file fails.
4. **B6 file check:** in `sniffVideo` (`src/utils/files.js`):
   - Accept `ftyp` only with these brands: `isom`, `iso2`–`iso6`, `mp41`, `mp42`, `avc1`, `dash`, `M4V ` and `qt  `.
   - Reject `M4A `, `heic`, `mif1`, `msf1`, `avif` and all `3gp*`/`3g2*` brands.
   - Read 32 bytes if needed.
5. **B8 duplicate Drive folders:** in `googleDriveDriver.js`, store the in-flight lookup promise in `folderIdFor` so two uploads at the same moment share one lookup and one create.
6. **D3:** when Google returns `invalid_grant`, log a clear error ("Google Drive refresh token expired or revoked; make sure the OAuth app is In production and create a new token"). Document this in `backend/docs/setup.md`.
7. **Clean-up:** make the Drive driver use `src/utils/parseCredentials.js` and delete its own copy, and remove the `console.error('UPLOAD ERROR…')` in `videoController.create`.

Tests:
- Unit:
  - `sniffVideo` accepts and rejects each listed brand.
  - The `folderIdFor` lookups at the same moment create only one folder (fake Drive API).
  - The `invalid_grant` message is logged.
- Integration (fake Drive driver):
  - The temp file is gone after successful recording, video and demo uploads.
  - If `remove()` throws, the cooldown is still released and the original error is returned.
  - Old temp files are cleaned up at startup.
  - `.m4a` and `.3gp` uploads get 422.

Done when the tests pass and a production upload leaves `uploads/tmp` empty.

---

## Phase 3 – Dependency updates (S1)

1. Backend: `npm audit fix`, then update mongoose (latest 7.x or later), multer (patched 2.x), zod (≥ 4.6.6) and express/body-parser to patched versions. Run all tests.
2. Frontend: update vite to a patched 8.x.
3. Confirm `npm audit --omit=dev` shows 0 high issues in both folders.
4. List any version changes in the PR, so Table 17 in the SRS can be updated.

Tests: no new behaviour, so the whole existing suite (unit, integration, security, E2E) is the check. Make the CI audit job required from now on.

Done when audit is clean and the full test gate passes.

---

## Phase 4 – Contact form and deletion requests (C2, S4, D4)

**Goal:** FR13.13 works from start to finish.

Frontend (`src/pages/Landing.jsx`, `ContactForm`):
1. Restore the topic `<select>`:
   - Signed-in contributors see General inquiry, Partnership and Request recording/data deletion.
   - Signed-out visitors see only the deletion topic, which is also their default.
2. Call `api.contact.send({ topic, name, email, message })`. Handle loading, success (`status = 'sent'`), field errors (`error.fields`) and 429/403 messages.
3. Show the deletion explanation when that topic is selected (the commented-out text is already written).
4. **Verification page** `/contact/verify?id=<messageId>`:
   - one 6-digit code field and a resend button (60 s)
   - shown straight after a signed-out deletion request is sent
5. Tests: submitting calls the API; a signed-out visitor sends `recording-deletion`; the verify page submits the code; errors are shown.

Backend (`src/services/contactService.js` and new pieces):
1. **S4:** remove the 10-minute block from the site-wide cap; reaching it returns 429 only.
   - Add a `ContactSenderQuota` model (hashed IP/device + day) for the signed-out limit of 2 deletion requests a day.
   - Keep the signed-in limit of 1 general/partnership message a day; deletion requests don't count toward it.
2. Replace the automatic block for "signed-in user typed a different email" with a plain 403 (no block).
3. Add these fields to `ContactMessage`:
   - `verified` (boolean)
   - `verificationCodeHash`, `verificationExpiresAt` and `verificationAttempts` (`select: false`)
   - `status` (`open` / `done` / `rejected`, default `open`), `handledAt` and `handledBy`
4. **D4 emailed code:**
   - **Signed-out deletion request:** save it with `verified:false`. If an account exists for that email, send a 6-digit code through Brevo (same HMAC pattern, 10-minute expiry and 5 attempts as `authService`).
   - **Response:** always the same, whether or not the account exists (no account guessing): `{ received: true, id, verificationRequired: true }`.
   - **New routes:** `POST /api/v1/contact/:id/verify` with `{ code }`, and `POST /api/v1/contact/:id/resend` (60 s limit), both rate-limited.
   - **No account for that email:** the request stays `verified:false` and the admin page shows it as "manual check".
   - **Signed-in deletion request:** `verified:true` immediately.
   - Forward the message to Web3Forms as now, with "(verification pending)" or "(verified)" in the subject.

Tests:
- Unit: the contact schema, the code hashing and expiry, and the quota logic.
- Integration:
  - Signed-out general → 403 and no block.
  - Signed-out deletion → 201, `verified:false`, and the code captured.
  - A correct code → `verified:true`; 5 wrong codes → the code stops working; resend is refused within 60 s.
  - Reaching the site-wide cap → 429 and no block.
  - The per-sender limit works.
  - The same response whether or not the account exists.
- Frontend integration (MSW): the form sends the right topic for signed-in and signed-out users; the error states; the verify page.
- E2E:
  - A signed-in contact message.
  - Signed-out deletion request → code from `/__test/emails` → verified.
- Security: add the new routes to the access matrix.

---

## Phase 5 – Admin tools for deletion requests and messages (C3)

**Goal:** an admin can act on a deletion request inside the site.

Backend:
1. Add `DELETE /api/v1/admin/users/:id/submissions` (`adminRoutes.js`), served by a new `submissionService.removeAllForUser(userId, admin)`:
   - Load all of the user's submissions.
   - Delete each Drive file (`storageService.remove`). Keep going if one fails, and collect the failures.
   - Delete the Submission and SubmissionCooldown documents.
   - Return `{ deleted, failed: [{ id, reason }] }`.
2. Accept an optional `?withRecordings=true` on `DELETE /admin/users/:id`, which runs step 1 first.
3. Add a `DeletionLog` model: `userId`, a SHA-256 hash of the email, the counts deleted and failed, `requestMessageId`, `adminId` and `at`. Never store the email itself.
4. Add a `DeletedAccount` model (`userId` + email hash + `deletedAt`), written whenever an account is deleted by an admin or by the contributor. A later deletion request can then be matched to the user's leftover recordings by hashing the request email.
5. Add `GET /admin/users/:id/submissions` (paginated) so the admin can see what will be deleted.
6. Add `GET /admin/messages` filters (`topic`, `status`, `verified`) and `PATCH /admin/messages/:id` to set `status` (this records `handledAt`/`handledBy`).
7. Add `GET /admin/deletion-lookup?email=` (admin only). It hashes the email and returns the matching current user or `DeletedAccount`, plus their submission count.

Frontend:
1. New page **Admin → Messages** (`src/pages/admin/AdminMessages.jsx`, route `admin/messages`, link in `AdminLayout`):
   - A table of topic, name, email, date, a verified / unverified / manual check badge, and status.
   - Filters for topic, status and verified.
   - For deletion requests:
     - "Find contributor" (calls the lookup) and "Delete recordings" (shows the count and asks for confirmation).
     - Then "Mark done" or "Reject".
2. In `AdminUsers.jsx`:
   - Add a "Delete recordings" button that shows the count and asks for confirmation.
   - Add a "Delete account and recordings" option next to "Delete".
   - Update the confirmation texts.
3. Keep the consent notice and policy text as they are. Account deletion still doesn't remove recordings on its own, and recordings are removed on request, so the text stays true and `CONSENT_VERSION` doesn't change.

Tests:
- Unit: `removeAllForUser` keeps going after one failed delete; the email hashing is consistent between `DeletedAccount` and the lookup.
- Integration:
  - Deleting a user's recordings removes the files (fake Drive driver) and the documents, and writes a `DeletionLog` without the plain email.
  - `withRecordings=true` on user delete.
  - A partial failure is reported.
  - The lookup finds a deleted account by email hash.
  - Message status changes are saved.
- Frontend integration (MSW): the Messages page lists, filters and marks done; the confirmation shows the right count.
- E2E: a contributor submits 2 recordings → sends a deletion request → the admin finds them in Messages → deletes the recordings → the contributor's profile shows 0.
- Security: a non-admin gets 403 on every new route (access matrix).

Done when an admin can go from a deletion message to "0 recordings left" for that person in both Drive and MongoDB.

---

## Phase 6 – Account security (S2, S6, S9, B2, B3, B4, password change)

1. **S2 account lockout:**
   - Add `failedLoginCount` and `lockedUntil` to `User` (`select: false`).
   - In `authService.login`, after 5 wrong passwords set `lockedUntil = now + 15 min`. While it is locked, refuse with "Too many failed attempts. Try again in 15 minutes." Reset the count after a successful login or a password reset.
   - Make the limits environment variables (`AUTH_LOCKOUT_ATTEMPTS=5`, `AUTH_LOCKOUT_MINUTES=15`).
   - Keep the dummy-hash timing protection for unknown emails.
2. **S6 logout:** bump `authVersion` on logout so the old JWT stops working. Add a "Log out of all devices" button on the profile page; it calls the same logout.
3. **Password change while logged in:** add `POST /users/me/password` with `{ currentPassword, password, confirmPassword }`. It bumps `authVersion`, sets a new cookie, and appears as a form on the profile page.
4. **S9 unfinished sign-ups:** delete users with `emailVerified:false` 24 h after `createdAt`, using a TTL index with `partialFilterExpression: { emailVerified: false, role: 'user' }`. Admin accounts can never match it.
5. **B2:** count only `emailVerified: true` contributors in `publicStatsService`, `statsService` and `countByRole`.
6. **B3:** when a sign-up email belongs to an unverified account:
   - update the names and password hash,
   - resend the code (keeping the 60 s resend limit),
   - return the same success response as a new sign-up.
7. **B4:** keep `consentToken` and its expiry in `sessionStorage` in `VerifyEmail.jsx` / `Consent.jsx`, so a refresh doesn't lose it. Clear it on accept or decline.
8. **Code expiry:** change the default `AUTH_OTP_TTL_MINUTES` in `env.js` to 10. The email text already reads the value.

Tests:
- Unit: the lockout counter logic, including unlock once the time has passed (use a fake clock); the TTL index definition and partial filter; the counts filter.
- Integration:
  - Lockout after 5 attempts and the count reset after success.
  - The old JWT is rejected after logout and after a password change.
  - The password change endpoint: wrong current password → 401.
  - Re-sign-up of an unverified email.
  - The 10-minute code expiry.
- Frontend integration (MSW):
  - the password change form
  - "Log out of all devices"
  - the consent token surviving a page reload
- E2E:
  - Wrong password 5 times → the lockout message.
  - Forgot password → reset → the old session is logged out.
  - Reload on the consent page keeps the user on it.
- Security: extend the JWT checks in 4.5.

---

## Phase 7 – Admins and activity log (S7, D5)

1. **Admin list:**
   - Add `ADMIN_EMAILS` (comma-separated, optional) to `env.js`. `ADMIN_EMAIL` and `ADMIN_PASSWORD` keep creating the first admin as now.
   - On startup (`authService.ensureAdminFromEnv`):
     - every *existing, verified* account whose email is in `ADMIN_EMAIL` or `ADMIN_EMAILS` becomes `admin`;
     - every admin not on those lists goes back to `user`.
   - Never demote the last active admin.
   - Team members first sign up on the site in the normal way. They are promoted on the next restart, so the README should say to restart after editing the list.
2. **Activity log:** add an `AuditLog` model: `actorId`, `action`, `targetType`, `targetId`, `meta` (small object, no secrets) and `at`, indexed on `at`.
   - Write an entry for:
     - video create/update/delete
     - category create/update/delete
     - demo upload/delete
     - user suspend/reactivate/delete
     - recordings deleted
     - restriction create/remove
     - message status changed
     - admin promoted/demoted at startup (actor = "system")
   - Add an `auditService.record()` helper and call it from the services, not the controllers.
3. Add `GET /admin/audit` (paginated, filter by actor and action) and a simple **Admin → Activity** page.
4. Log login attempts to the server log at `info` level: email hash, success or failure, IP. No passwords.

Tests:
- Unit: the promotion/demotion rules (including never demoting the last admin); `auditService.record()` keeps secrets out of `meta`.
- Integration: each admin action listed above creates exactly one audit entry with the right actor; the audit list paginates and filters.
- Frontend integration (MSW): the Activity page.
- E2E: two different admin accounts make changes, and each change shows the right name in Activity.
- Security: only admins can read the log (access matrix).

---

## Phase 8 – Data export for the ML team and scaling (B5, B7)

1. Add `GET /api/v1/admin/submissions` with filters (`categoryId`, `videoId`, `userId`, `from`, `to`) and cursor pagination.
2. Add `GET /api/v1/admin/submissions/export?format=csv|json`, streamed. The columns are:
   - `submissionId`, `userId`, `videoId`, `videoTitle`, `categoryId`, `categoryLabel`
   - `driveFileId` (`recording.key`), `archivePath`, `mimeType`, `size`, `duration`
   - `trimStart`, `trimEnd`, `mirrored`, `submittedAt`
   - No names or emails.
3. Add a new page **Admin → Submissions** with a filterable table and "Download CSV" / "Download JSON" buttons.
4. Add a script `backend/scripts/prepare-dataset.js`:
   - **input:** the export JSON
   - **does:** downloads each file by Drive ID and uses ffmpeg to apply the trim and mirror
   - **output:** `<category>/<video>/<submissionId>.mp4`
   - It runs on a team machine, not on the server, and is documented in `backend/docs/`.
5. **B7 dashboard:**
   - Change `AdminDashboard.jsx` to use `GET /admin/stats?days=`. Add optional `userId` and `categoryId` filters to that endpoint so the page's current filters keep working.
   - For admins, stop `LibraryProvider` from loading every submission.
   - Paginate `GET /admin/users` and the admin `GET /submissions`.

Tests:
- Unit:
  - CSV escaping (commas, quotes, Urdu text in titles).
  - The stats bucketing by day.
  - `prepare-dataset.js` builds the right ffmpeg arguments for trim and mirror (no real ffmpeg needed).
- Integration:
  - Export columns and filters, with no emails or names anywhere in the output.
  - Cursor pagination.
  - The `/admin/stats` filters.
- Frontend integration (MSW): the Submissions page and download buttons; the dashboard renders from `/admin/stats` without calling the submissions list.
- E2E: an admin downloads the CSV, and the test checks its rows against the submissions made in the test.

---

## Phase 9 – Frontend hardening and clean-up (S8, S10, leftovers)

1. **S8 security headers:** add a `headers` section to `frontend/vercel.json`:
   - `Content-Security-Policy`:
     - `default-src 'self'`
     - `connect-src 'self' https://api.<DOMAIN>`
     - `media-src 'self' https://api.<DOMAIN> blob: https:` (`https:` because admins can add external HTTPS videos)
     - `img-src 'self' https://api.<DOMAIN> data: blob:`
     - `style-src 'self' https://fonts.googleapis.com 'unsafe-inline'`
     - `font-src https://fonts.gstatic.com`
     - `script-src 'self' 'wasm-unsafe-eval'`
     - `worker-src 'self' blob:`
     - `frame-ancestors 'none'`
     - `base-uri 'self'`
     - `form-action 'self'`
   - Also `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
   - Move the inline theme script in `index.html` to `public/theme-init.js`, so no inline script is needed.
2. **ffmpeg:** copy the `@ffmpeg/core` 0.12.10 files into `frontend/public/ffmpeg/`, point `CORE_BASE` in `src/utils/processVideo.js` at `/ffmpeg`, and drop jsDelivr from the CSP.
3. **S10:** in `app.js`, accept an incoming `X-Request-Id` only if it matches `^[A-Za-z0-9-]{1,64}$`; otherwise generate a new one.
4. **Bundle size:** load the admin pages and `RecordingEditor` with `React.lazy`/`Suspense` in `App.jsx`. Aim for a main chunk under 300 KB.
5. Remove the unused `src/utils/blobStore.js`. Add a note to the frontend docs that notifications are kept per browser.
6. **Accessibility** (SRS C.3 / QA-20): run axe (`@axe-core/react` in dev or a Vitest axe check) on the landing, library, record, editor and admin pages, and fix the serious contrast and label problems.

Tests:
- Copy the same security headers into `vite.config.js` `preview.headers`, so the E2E run uses the real CSP. Add a unit test that the two sets of headers match.
- E2E:
  - The whole suite runs with the CSP active, and fails on any console CSP error.
  - The admin video tool works with ffmpeg from `/ffmpeg`.
  - axe checks on the listed pages (`@axe-core/playwright`), failing on serious problems.
- Unit: the `X-Request-Id` check.
- CI: a bundle-size check that fails if the main chunk is over 300 KB.

Done when the site works with the CSP in production (no CSP errors in the browser console), the main chunk is under 300 KB, and axe reports no serious problems.

---

## Phase 10 – Docs, SRS sync and final check

1. Update `backend/docs/*`, `frontend/docs/*`, the READMEs and `openapi.js` for every new route and environment variable.
2. Write a `CHANGELOG.md` entry for each phase's version.
3. SRS follow-ups (done by hand in Word, not by Claude Code):
   - Figure 5 and 3.3.4: the contribution site's backend runs on the team's own server (Hostinger VPS or the university server) behind Nginx; the frontend stays on Vercel.
   - Table 15: Drive authentication through OAuth.
   - FR13.13: the emailed code and the admin deletion tools.
   - FR13.12 / roles: separate admin accounts and the activity log.
   - Table 17 versions, if Phase 3 changed them.
4. Make sure every line of the list below that can be automated has a Playwright test. Then add a `@smoke` tag to a short subset that can run against the real production site with a test account (`npm run e2e:smoke -- --base-url=https://commons.<DOMAIN>`). The subset must not create real recordings; it covers login, library and profile only.
5. Final check of `backend/docs/TEST-CASES.md`: every FR13.x requirement and every checklist ID has at least one test.
6. Manual test checklist on production (record the results in the final PR and in `docs/phase-reports/PHASE-10.md`):
   - [ ] Sign-up → code (10 min) → consent → library, on Chrome, Safari iOS and Android Chrome.
   - [ ] Wrong password 5 times → locked; works again after 15 minutes.
   - [ ] Forgot password → code → reset; old sessions are logged out.
   - [ ] Record, trim, mirror and submit; the cooldown shows the time left; a second submit after 30 s works.
   - [ ] A recording of about 90 MB uploads; one over 100 MB is refused with a reason.
   - [ ] Suspended user: can't log in or submit.
   - [ ] IP/device restriction blocks access, and the admin can remove it.
   - [ ] Signed-in contact message arrives; a signed-out deletion request → emailed code → "verified" in Admin → Messages.
   - [ ] Admin deletes a contributor's recordings → files gone from Drive, the count is 0, and it appears in Admin → Activity.
   - [ ] Each team member logs in with their own admin account.
   - [ ] CSV export opens with correct trim and mirror values; `prepare-dataset.js` produces trimmed clips.
   - [ ] `uploads/tmp` on the server is empty after the uploads.
   - [ ] `npm audit --omit=dev` shows 0 high issues; CI is green on `main`.

---

## Phase summary

| Phase | Covers | Size | Depends on |
| --- | --- | --- | --- |
| 0 Baseline and test infrastructure | Test layout, coverage, E2E, CI | M | – |
| 1 Server, domain and sessions | C1, C4, S3, S5 | M | 0 |
| 2 Storage reliability | C5, B1, B6, B8 | S | 0 |
| 3 Dependencies | S1 | S | 2 |
| 4 Contact and deletion requests | C2, S4 | M | 1 |
| 5 Admin deletion tools | C3 | M | 4 |
| 6 Account security | S2, S6, S9, B2–B4 | M | 3 |
| 7 Admins and activity log | S7 | M | 5 |
| 8 ML export and scaling | B5, B7 | M | 5 |
| 9 Frontend hardening | S8, S10, leftovers | M | 1 |
| 10 Docs and final check | SRS sync | S | all |

Phases 1–5 are what make the site complete against the SRS. Phases 6–9 make it secure and ready to scale.

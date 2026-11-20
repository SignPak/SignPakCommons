# Phase 0 – Baseline and test infrastructure

## Phase and branch

| | |
| --- | --- |
| Phase | 0 – Baseline and test infrastructure (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-0-test-infrastructure` (from `main` @ `b10d90b`) |
| Commits | `c654adf` the phase, `c227e08` the lockfile fix, then report updates. The branch head is whatever `git log -1 fix/phase-0-test-infrastructure` reports — a commit cannot contain its own hash, so the head is the last report commit. |
| Pull request | [#30](https://github.com/SignPak/SignPakCommons/pull/30) |
| Versions | backend `1.0.5 → 1.0.6`, frontend `1.0.8 → 1.0.9` |

No app behaviour changed in this phase. It records the baseline, moves the existing tests
into the layout of FIX-PLAN section 4.1, adds the missing unit / security / E2E levels and the
coverage gate, and replaces the two old CI workflows with the full gate.

## Checklist items done

Phase 0 fixes no numbered checklist item (C1–C5, S1–S10, B1–B8); it builds the test levels the
later phases need. One leftover line from the checklist is now done:

| Item | How it was fixed |
| --- | --- |
| "The backend tests run only on pull requests (`.github/workflows`). Also run them on pushes to `main`." | `.github/workflows/ci.yml` runs backend, frontend, e2e and audit jobs on `push` and `pull_request`; `backend-tests.yml` and `frontend-build.yml` were folded into it so nothing runs twice. |

### Checklist claims checked against the code first

Every claim in `docs/SignPakCommons review checklist.md` was read against the code before
planning. All of them hold. Three are worth recording more precisely:

- **C5** is real (`src/services/storage/index.js` never deletes `tempPath`; only
  `localDriver.save` consumes it with `rename`), but the leak is **only on the success path** —
  `middlewares/errorHandler.js` already calls `removeQuietly(req.file.path)` on every failure.
  Phase 2 should keep that distinction in its test names.
- **S1** is real, with a correction: the checklist calls vite "dev server only", but vite is in
  the **production** dependency graph through `@tailwindcss/vite`, which is a prod dependency.
  That is why `npm audit --omit=dev` fails on the frontend too, and Phase 3 has to update it
  rather than dismiss it as a dev-only finding.
- **C1** could not be verified from this machine (it is about the live deployment); it stays
  for Phase 1.
- A documentation bug not in the checklist: `backend/AGENTS.md`, `backend/README.md`,
  `backend/docs/README.md` and `backend/docs/MODULE-REFERENCE.md` all linked to
  `docs/SETUP.md`, but the file is `backend/docs/setup.md`. Those links 404 on GitHub (and on
  any case-sensitive host). Fixed here, since it is documentation only.
- `backend/docs/TEST-CASES.md` claimed 61 cases; the real count was 64, and cases 59–61 were
  listed under `videoService.test.js` when they are the `api-consent.test.js` cases. The
  rewrite into the traceability table fixes both.

## Files changed

### Repository root
- `.nvmrc` **(new)** — `22`.
- `.gitignore` — ignore `coverage/`, `e2e/test-results/`, `e2e/playwright-report/`,
  `.playwright/`.
- `.github/workflows/ci.yml` **(new)** — jobs `backend`, `frontend`, `e2e`, `audit` on push and
  pull request, with npm, MongoDB-binary and Playwright-browser caches.
- `.github/workflows/backend-tests.yml`, `.github/workflows/frontend-build.yml`
  **(deleted)** — replaced by `ci.yml`.
- `CONTRIBUTING.md` — the test gate contributors are expected to run, and the rule that a new
  route needs an access-matrix entry.
- `docs/SignPakCommons review checklist.md` — ticked the CI line.
- `docs/phase-reports/PHASE-0.md` **(new)** — this report.

### Backend — source
- `src/config/env.js` — added `EMAIL_DRIVER` (`brevo` default, `capture` in tests) and
  `E2E_TEST_HOOKS` (`false` default); production refuses to start with either test setting.
- `src/services/email/index.js`, `brevoDriver.js`, `captureDriver.js` **(new)** — the email
  driver seam. `external/sendOTPBrevo.js` is unchanged and still does the provider call.
- `src/services/authService.js` — `sendOTPEmail` now delegates to `emailService.sendOtp`; it
  is still an overridable property.
- `src/routes/testHooks.js` **(new)** — `GET /__test/emails?to=&purpose=`.
- `src/app.js` — mounts `/__test` only when `env.isTest && env.E2E_TEST_HOOKS`.
- `.env.example` — documents both new variables, including "never in production".
- `scripts/e2e-server.js` **(new)** — the API the Playwright suite runs against.
- `scripts/check-coverage.js` **(new)** — per-directory coverage floors.
- `.c8rc.json`, `coverage-thresholds.json` **(new)** — coverage configuration.
- `package.json` — version `1.0.6`, `c8` devDependency, and the `test:unit`,
  `test:integration`, `test:security`, `test`, `test:coverage`, `e2e:server` scripts.

### Backend — tests
Moved (content unchanged apart from import depth):

| From | To |
| --- | --- |
| `tests/helpers.js`, `tests/apiContext.js`, `tests/videoServiceTestHelpers.js` | `tests/support/` |
| `tests/api-*.test.js` (10 files) | `tests/integration/` |
| `tests/safeName.test.js`, `tests/localStorage.test.js`, `tests/videoService.test.js` | `tests/unit/` |

`tests/support/apiContext.js` now reads codes from the capture email driver instead of
monkey-patching `authService.sendOTPEmail`, keeping the same `deliveredCodes.get('email:purpose')`
interface the ten integration files already used, so no integration test changed.

New:
- `tests/support/fakeDriveDriver.js` — in-memory driver with the Google Drive interface and
  `failOn.{save,stat,remove}` switches.
- `tests/support/routeInventory.js` — walks the Express router stack.
- `tests/unit/fakeDriveDriver.test.js`, `tests/unit/emailDriver.test.js`,
  `tests/unit/env-guards.test.js`.
- `tests/security/access-matrix.test.js`, `tests/security/test-hooks.test.js`.

### Frontend
- `package.json` — version `1.0.9`; `msw` and `@vitest/coverage-v8` devDependencies;
  `test`, `test:unit`, `test:integration`, `test:coverage` scripts.
- `vite.config.js` — a `test` block (jsdom, v8 coverage, thresholds) inside the existing
  config, plus `preview.proxy` for `/api` so the E2E preview is same-origin with the API.
- `eslint.config.js` — lints `test/**` as well, and ignores generated `coverage/`.
- `test/*.test.{js,jsx}` (6 files) moved to `test/unit/`.
- `test/support/mswServer.js` **(new)** — shared MSW server and envelope helpers.
- `test/integration/Login.test.jsx` **(new)**.

### E2E (new)
- `e2e/package.json`, `e2e/package-lock.json`, `e2e/playwright.config.js`, `e2e/README.md`.
- `e2e/tests/landing.spec.js`, `e2e/tests/signup.spec.js`.

### Docs
- `backend/docs/TEST-CASES.md` — rewritten as the FIX-PLAN 4.7 traceability table
  (test ID → file → name → requirement → checklist ID → level), plus a "gaps to close"
  table pointing each remaining checklist ID at its phase.
- `backend/docs/setup.md` — the two new variables, the per-level test commands, fixtures, the
  coverage gate, the E2E pointer, and two production-checklist lines.
- `backend/docs/ARCHITECTURE.md`, `backend/docs/MODULE-REFERENCE.md`,
  `backend/docs/README.md`, `backend/AGENTS.md`, `backend/README.md`,
  `frontend/AGENTS.md`, `frontend/README.md`, `frontend/docs/architecture.md`,
  `frontend/docs/MODULE-REFERENCE.md` — test layout, the email driver, the test hook, and the
  `SETUP.md` → `setup.md` link fix.

`docs/API.md` and `src/docs/openapi.js` are deliberately unchanged: `/__test/emails` is a
test-only hook outside `/api/v1` that cannot exist in production, so it is documented in
`setup.md` and `e2e/README.md` instead of in the public API contract.

## New routes, models and environment variables

| Kind | Name | Notes |
| --- | --- | --- |
| Route | `GET /__test/emails?to=&purpose=` | Test-only. Mounted only when `NODE_ENV=test` **and** `E2E_TEST_HOOKS=true`. No `/api/v1` route was added, renamed or removed. |
| Model | — | none |
| Env | `EMAIL_DRIVER` | `brevo` \| `capture`; default `brevo`; `capture` in the test environment. Rejected in production. |
| Env | `E2E_TEST_HOOKS` | boolean, default `false`. Rejected in production. |

## Tests added

### Unit (backend, `tests/unit/`)
`fakeDriveDriver.test.js`
- fake Drive driver exposes the same interface as the real Google Drive driver
- fake Drive driver stores bytes under an opaque key and leaves the temp file alone
- fake Drive driver reuses one folder id per path and creates nested folders once
- fake Drive driver supports byte ranges and idempotent removal
- fake Drive driver can be told to fail on save, stat and remove

`emailDriver.test.js`
- the capture driver records recipient, purpose and code without sending anything
- captured codes can be filtered by recipient and purpose, newest first
- the capture store keeps only the last 100 codes and can be cleared
- the test environment selects the capture driver and brevo stays the default elsewhere
- authService sends its codes through the email driver

`env-guards.test.js`
- a valid production configuration starts with brevo mail and no test hooks
- production refuses to start with E2E_TEST_HOOKS enabled
- production refuses to start with the capture email driver
- an unknown email driver is rejected in every environment
- test environments may enable the hooks and the capture driver

### Security (backend, `tests/security/`)
`access-matrix.test.js`
- `<METHOD> <path>` enforces its access rules — one case per registered route (47 today),
  calling each as an anonymous visitor, a contributor, a suspended contributor and an admin
- every registered route has a matrix entry

`test-hooks.test.js`
- E2E_TEST_HOOKS is off in this environment
- GET /__test/emails does not exist without E2E_TEST_HOOKS
- the router stack contains no /__test route

### Integration (frontend, `test/integration/`)
`Login.test.jsx`
- signs the contributor in and puts the session in the auth provider
- shows the server message when the credentials are refused
- puts field errors from a 422 next to their input
- never reaches the network when the form itself is invalid

### End-to-end (`e2e/tests/`)
`landing.spec.js`
- loads and shows the public sections without page errors
- the API the site talks to is healthy through the preview proxy

`signup.spec.js`
- sign-up: form, emailed code, consent, then the library

No test was deleted, skipped, marked `.only`/`todo` or weakened. The 64 existing backend cases
and 20 frontend cases all still pass from their new locations.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, npm 11.8.0, on 20 Nov 2026. Pasted from the
real output, not from memory.

| Gate | Command | Result | Exit |
| --- | --- | --- | --- |
| Backend unit | `npm run test:unit` | tests 34, pass 34, fail 0 (6.0 s) | 0 |
| Backend integration | `npm run test:integration` | tests 45, suites 10, pass 45, fail 0 (30.2 s) | 0 |
| Backend security | `npm run test:security` | tests 51, suites 2, pass 51, fail 0 (6.3 s) | 0 |
| Backend coverage | `npm run test:coverage` | tests 130, pass 130, fail 0; floors passed | 0 |
| Frontend lint | `npm run lint` | clean, no errors or warnings | 0 |
| Frontend tests | `npm test` | Test Files 7 passed (7), Tests 24 passed (24) | 0 |
| Frontend coverage | `npm run test:coverage` | 24 passed; thresholds passed | 0 |
| Frontend build | `npm run build` | built in 383 ms; main chunk 526.09 kB (gzip 161.03 kB) | 0 |
| End-to-end | `npm run e2e` | **9 passed (28.6 s)** — 3 tests × chromium, firefox, webkit | 0 |
| Backend audit | `npm audit --omit=dev --audit-level=high` | **6 vulnerabilities (2 moderate, 4 high)** | 1 |
| Frontend audit | `npm audit --omit=dev --audit-level=high` | **2 high severity vulnerabilities** | 1 |

The two audit failures are the expected ones: FIX-PLAN allows the audit to fail until Phase 3,
and the `audit` CI job carries `continue-on-error: true` with a comment to that effect.
Everything else passes. No test was skipped, and no suite was shortened to make the gate pass.

### Test counts, before and after

| | Before (`main`) | After |
| --- | ---: | ---: |
| Backend unit | 19 | 34 |
| Backend integration | 45 | 45 |
| Backend security | 0 | 51 |
| Backend total | 64 | 130 |
| Frontend unit | 20 | 20 |
| Frontend integration | 0 | 4 |
| E2E | 0 | 9 (3 × 3 browsers) |
| **Total** | **84** | **163** |

All 64 existing backend cases are still there (19 unit + 45 integration, verified by running
the three moved unit files on their own); Phase 0 adds 15 unit and 51 security cases on top.
`localStorage.test.js` and `videoService.test.js` count as unit tests, per FIX-PLAN 4.1, even
though the old `TEST-CASES.md` called the first one a filesystem-integration test.

### Coverage, before and after

Backend "before" was measured with `node --experimental-test-coverage` (no coverage tooling
existed on `main`), which only counts files a test loaded. "After" is c8 with `all: true`,
which also counts files no test touches — so the two are not directly comparable and the
"after" number is the pessimistic one. Both are recorded for honesty.

| Scope | Before (node, loaded files only) | After (c8, all files) | Floor now | FIX-PLAN target |
| --- | --- | --- | --- | --- |
| Backend overall | 89.49% lines / 85.90% branches | **86.77% lines / 85.09% branches** | 75 / 75 | 75 lines |
| `src/services` | mixed, 9–100% per file | **77.77% lines / 82.09% branches** | 77 / 75 | 80 lines / 75 branches |
| `src/middlewares` | ~98% lines | **97.87% lines / 86.96% branches** | 80 / 75 | 80 / 75 |
| `src/utils` | ~100% lines | **82.67% lines / 89.36% branches** | 80 / 75 | 80 / 75 |
| Frontend overall | not measurable | **18.90% lines / 18.70% branches / 11.18% functions** | 18 / 18 / 11 | 70 lines |
| `frontend/src/utils` | not measurable | **25.74% lines** | 25 | 80 |
| `frontend/src/services` | not measurable | **20.46% lines** | 20 | 80 |

Only one backend floor is below its FIX-PLAN target: `src/services` lines, at 77.77% against
80%. The shortfall is `storage/googleDriveDriver.js` (9.3%), `external/sendOTPBrevo.js` (14.3%)
and `external/sendContactWeb3Forms.js` (16.7%), none of which can run without a real Google or
Brevo account. Phase 2 wires in `tests/support/fakeDriveDriver.js`, which should clear it.
`src/utils` is held back by `utils/parseCredentials.js`, which no code imports today — Phase 2
makes the Drive driver use it instead of its own copy.

Frontend floors are far below the 70% target, which is the honest baseline: 24 tests across
about 90 source files. Each later phase adds the page tests for the area it touches and raises
the floor; the mapping is in the gaps table in `backend/docs/TEST-CASES.md`.

### CI result

Run [44596374890](https://github.com/SignPak/SignPakCommons/actions/runs/44596374890) on
commit `c227e08`, Ubuntu + Node 22:

| Job | Conclusion |
| --- | --- |
| Backend (unit, integration, security, coverage) | **success** — all four steps green, "Coverage gate passed." |
| Frontend (lint, test, coverage, build) | **success** — Test Files 7 passed (7), Tests 24 passed (24) |
| End-to-end (Playwright) | **success** — "Running 9 tests using 1 worker", "9 passed (31.4s)" |
| Dependency audit (high and above) | **failure**, tolerated by `continue-on-error` until Phase 3 |
| **Overall run conclusion** | **success** |

### CI fix after the first push (commit 2)

The first push failed the `backend` and `e2e` jobs at `npm ci`:

```
npm error `npm ci` can only install packages when your package.json and package-lock.json
npm error or npm-shrinkwrap.json are in sync.
npm error Missing: gcp-metadata@5.3.0 from lock file
npm error Missing: gaxios@5.1.3 from lock file
... (9 packages, all under googleapis/google-auth-library)
```

Cause: the lockfiles were regenerated by the local npm 11.8 when `c8`, `msw` and
`@vitest/coverage-v8` were added, and npm 11 prunes lock entries that the npm 10 bundled with
Node 22 still requires. Reproduced locally with `npx npm@10 ci --dry-run` in `backend/`, which
failed with the same nine packages.

Fix: regenerated `backend/package-lock.json` and `frontend/package-lock.json` with
`npx npm@10 install --package-lock-only` (backend +134 lines, frontend +62/-2; no dependency
version changed, only restored lock entries). `e2e/package-lock.json` needed no change. Both
`npx npm@10 ci --dry-run` and `npm ci --dry-run` now pass in all three packages, and the full
suites were re-run afterwards (backend 130 passed, frontend 24 passed, lint clean).

The rule is now documented in `backend/AGENTS.md`, `frontend/AGENTS.md` and
`backend/docs/setup.md`, so a later phase does not reintroduce it.

### FIX-PLAN "done when" list

- [x] The full test gate passes locally (audit may fail until Phase 3).
- [x] CI is green on the branch (run 44596374890; the audit job fails by design).
- [x] Coverage numbers are recorded, before and after, with the floors they set.
- [x] The existing tests all still pass in their new places (64 backend, 20 frontend).

## How to verify by hand

```sh
git switch fix/phase-0-test-infrastructure

cd backend && npm ci
npm run test:unit && npm run test:integration && npm run test:security && npm run test:coverage

cd ../frontend && npm ci
npm run lint && npm test && npm run test:coverage && npm run build

cd ../e2e && npm ci && npx playwright install
npm run e2e

# Expected to fail until Phase 3:
cd ../backend && npm audit --omit=dev --audit-level=high
cd ../frontend && npm audit --omit=dev --audit-level=high
```

Spot checks worth doing by hand:

1. **The test hook cannot ship.** With the API running normally
   (`cd backend && npm run dev`), `curl http://localhost:5000/__test/emails` returns 404.
   Then put `NODE_ENV=production` and `E2E_TEST_HOOKS=true` in the environment and start the
   server: it exits with a configuration error instead of booting.
2. **Email still goes out in production mode.** `EMAIL_DRIVER` defaults to `brevo`, so a
   normal `npm run dev` (or production) start behaves exactly as before this phase.
3. **The access matrix is not optional.** Add a throwaway route to any router and run
   `npm run test:security`: the last case fails with the route name until the matrix has an
   entry for it.

## Not done, and deviations from the plan

1. **No checklist item is fixed.** Phase 0 is infrastructure, as FIX-PLAN specifies. The
   `<ID>: …` regression-test naming convention starts in Phase 1.
2. **The fake Drive driver is not wired into the integration app yet.** FIX-PLAN Phase 0.4 only
   asks for the driver, so it is exercised by its own unit test and nothing else;
   `src/services/storage/index.js` is untouched. Phase 2 adds the injection seam and the
   temp-file and cooldown tests that use it.
3. **Coverage floors start at the measured baseline where it is below the FIX-PLAN target**,
   which FIX-PLAN Phase 0.3 explicitly allows. See the table below for every floor, the number
   it has to reach, and the phase that should get it there. Floors live in
   `backend/coverage-thresholds.json` and the `test.coverage.thresholds` block in
   `frontend/vite.config.js`, so a later lowering shows up in a diff.
4. **Two scripts live in `backend/scripts/` rather than under `e2e/`**
   (`e2e-server.js`, `check-coverage.js`). FIX-PLAN says `e2e/` starts the backend in test
   mode but not where the glue lives; keeping the harness in `backend/` lets it reuse this
   package's `mongodb-memory-server` instead of downloading the ~600 MB MongoDB binary a
   second time under `e2e/`.
5. **The E2E suite uses Playwright's `webServer` rather than a `globalSetup` file.** FIX-PLAN
   Phase 0.8 asks for "a global setup that starts the backend ... and `vite preview`";
   `webServer` entries do exactly that, with health-check polling and automatic shutdown, so
   there is no separate global-setup module.
6. **`npm run test:coverage` on the backend runs the suite a second time** (once for
   `npm test`, once under c8). That is the straightforward way to get c8 to instrument Node's
   test runner; it costs about 45 s in CI.
7. **Backend test scripts use glob arguments, not bare directories.** `node --test tests/unit`
   fails on Node 24 (it treats the directory as a module) while
   `node --test "tests/unit/**/*.test.js"` works on both 22 and 24, so the glob form is used.
8. **Three source files were touched in a "no behaviour change" phase**
   (`src/config/env.js`, `src/app.js`, `src/services/authService.js`). All three changes are
   the email-driver seam and the guarded test route that FIX-PLAN Phase 0.5 requires. With
   `EMAIL_DRIVER=brevo` and `E2E_TEST_HOOKS=false` — the defaults outside tests — the
   behaviour is identical to `main`.
9. **The two old CI workflows were deleted,** with your approval, rather than kept alongside
   `ci.yml`. If any branch-protection rule names the old checks ("Backend tests", "Frontend
   build") it has to be repointed at `backend`, `frontend`, `e2e`, `audit` — a GitHub settings
   change I cannot make.

## Known risks

1. **`npm audit` fails in both packages** (backend: 4 high, 2 moderate; frontend: 2 high). The
   `audit` CI job is `continue-on-error: true` with a comment saying Phase 3 removes that line.
   Until then CI can be green with known-vulnerable dependencies.
2. **Frontend coverage floors are very low** (18% lines). They reflect reality — 24 tests over
   about 90 source files — and are a floor, not a target. The risk is that they stay low; the
   gaps table in `backend/docs/TEST-CASES.md` names the phase that should raise each one.
3. **First runs are slow.** The backend suite downloads a ~600 MB MongoDB binary once, and the
   E2E suite downloads the three Playwright browser engines once. Both are cached afterwards
   (locally and in CI), but a cold CI cache makes the first run long.
4. **CI is green, on its second attempt.** Run 44596374890 passes backend, frontend and e2e
   on Ubuntu + Node 22 (the audit job fails by design). The first attempt failed at `npm ci`;
   see "CI fix after the first push" above. Residual risk: `ci.yml` has now run exactly twice,
   both times with a cold MongoDB and Playwright cache, so the cache-hit path is unproven.
5. **WebKit and Firefox E2E** pass both locally (Windows) and in CI (Ubuntu), 9 tests in each
   environment, with no retries used. They are still the least predictable targets, and the
   suite is small — a flake would more likely show up as later phases add real flows.
6. **The access matrix asserts "not 401/403" for an allowed caller**, not an exact status. That
   is deliberate — it keeps the table about access control rather than duplicating every route's
   body rules — but it means the matrix would not notice a route that starts answering 500 to
   an authorised caller. The integration suites cover those paths.
7. **`/__test/emails` exists in the codebase.** Three independent guards keep it out of
   production (`env.isTest`, `E2E_TEST_HOOKS`, and the `env.js` production refusal), and five
   tests assert them, but it is still code that must never be reachable. Worth a look in every
   future review.

## Fixes after verification

### 1. Wrong SE mappings in `backend/docs/TEST-CASES.md`
Every row was re-checked against the SRS definitions (SE-1 RBAC, SE-2 sessions/JWT/logout,
SE-3 password hashing, SE-4 lockout, SE-6 data separation, SE-9 valid token, SE-10 server-side
validation). All corrections from the verification list were applied as given. Beyond that list,
a row now cites an SE only when its test asserts that behaviour (checked in each test body):
- Added: I-06, I-19, I-40 → SE-10; I-07 → SE-1, SE-2, SE-3 (ignores a submitted role, cookie
  attributes, no hash in the response); I-12, I-18, I-24, I-25, I-28, I-37 → SE-1; I-17, I-30 →
  SE-9 + SE-10; I-20, I-27, I-39 → SE-1 + SE-10; I-31 → SE-6 (another contributor sees 0
  submissions); I-41, I-42 → SE-2 (old session gets 401).
- I-10 (same answer for wrong password and unknown email) → FR13.1 only; it is not lockout.
- No row cites SE-4 any more: lockout does not exist until Phase 6.
- U-20–U-27 (fake Drive driver, capture email store) → "— (test infrastructure)"; I-01 (root
  and docs routes) → "— (API metadata)". Previously FR13.x, which they don't test.
- **Please check:** I-42 and FU-17 (contributor *self*-deletion) moved from FR13.12 to FR13.13.
  FR13.12 covers admin suspend/delete; FR13.13 is the deletion-request flow these tests' "recordings
  remain until requested" behaviour belongs to. The SRS isn't in the repo, so I couldn't confirm.
- The table legend now states these definitions.

Regression guard: new `backend/tests/unit/traceability.test.js` (U-35–U-37) fails if the table
cites an undefined requirement ID (e.g. SE-5), or lists a test file/name that does not exist
(parameterised `it.each` names are matched against their `%s` template). Verified it fails when
I-04 is set back to SE-5.

### 2. Frontend audit skipped when the backend audit fails
Added `if: always()` to "Audit frontend production dependencies" in `.github/workflows/ci.yml`.
No unit test: the CI run on this push is the check (the frontend audit step must run even though
the backend audit fails).

### Test gate after the fixes (local, 20 Nov 2026)
| Gate | Result | Exit |
| --- | --- | --- |
| backend test:unit | 37 passed (34 + 3 new) | 0 |
| backend test:integration / test:security | 45 / 51 passed | 0 |
| backend test:coverage | 130 passed before the new test; 86.77% lines / 85.09% branches; floors passed | 0 |
| frontend lint / test / test:coverage / build | clean / 24 passed / passed / built | 0 |
| e2e | 9 passed (36.8 s), chromium + firefox + webkit | 0 |
| audits | backend 6 (4 high), frontend 2 high | 1 (expected until Phase 3) |

Not re-run after adding the traceability test: `test:coverage` (the new test reads docs only and
adds no `src` coverage).

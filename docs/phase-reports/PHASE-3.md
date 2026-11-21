# Phase 3 – Dependency updates (S1)

## Phase and branch

| | |
| --- | --- |
| Phase | 3 – Dependency updates (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-3-dependency-updates` (from `main` @ `dc4c8ab`, Phase 2 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.8 → 1.0.9`, frontend `1.0.10 → 1.0.11` |

Also in this phase, at your request: the backend **overall** coverage floor goes from 75% to
**85% lines**.

## Checklist items

| ID | State | How |
| --- | --- | --- |
| **S1** | **Done, ticked** | Every production dependency with a published advisory is updated to a patched release on its current major (no semver-major bump anywhere). `npm audit --omit=dev --audit-level=high` now finds **0 vulnerabilities** in `backend/` and `frontend/`, and the CI `audit` job is **required** (`continue-on-error` removed). |

## What was vulnerable (verified per advisory)

| Package | Advisories | Fixed from |
| --- | --- | --- |
| mongoose | GHSA-gg4r-jv3p-qx3c (high), GHSA-8332-j7wj-wjw4 (high), GHSA-wr5m-5jph-8m96, GHSA-6972-9mcm-vhwj | 7.8.13 |
| multer | GHSA-q7qp-rjg7-q26m (high, DoS) | 2.5.0 |
| zod | GHSA-mrhx-c7xc-m3w5 (high, memory exhaustion) | 4.6.6 |
| body-parser (under express) | GHSA-27r3-jxmh-p828 (high, DoS) | 1.20.9 |
| qs (under express) | GHSA-6pq8-jhm2-2vcw (moderate) | 6.16.1 |
| ip-address (under express-rate-limit, mongodb) | GHSA-rxp7-6hxx-x8q5 (moderate) | 10.7.4 |
| vite (prod graph via `@tailwindcss/vite`) | GHSA-587h-7wmj-h5pm (high) and 5 moderate/low | 8.3.3 |
| source-map-js (under tailwind/postcss) | GHSA-68fv-2mgg-jv7q (high) | 1.2.2 |

The app doesn't use the advisories' trigger features directly: no `sanitizeFilter`,
discriminators or schema virtuals, and multer's `fileFilter` is synchronous. The mongoose
hydration/prototype issues are internal, so it's patched regardless. **Express stays on
4.22.3** (already the latest 4.x); its fix is the body-parser/qs update its own ranges allow.

## Version changes (for SRS Table 17)

Your planning choice was **settled releases**: every install ran with `--before=2026-11-07`,
two weeks before the update, so npm resolved every package as the registry stood then. Newer
releases that existed but were less than two weeks old were **not** taken: mongoose 7.8.14
(4 days old), vite 8.3.8 (9 days), source-map-js 1.2.4 (1 day).

This table comes from the lockfile diff and lists every version that changed:

**Backend — production**

| Package | Before | After | Why |
| --- | --- | --- | --- |
| mongoose | 7.8.12 | **7.8.13** | S1 (direct) |
| mquery | 5.0.0 | 5.0.1 | comes with mongoose 7.8.13 |
| multer | 2.4.0 | **2.5.0** | S1 (direct) |
| zod | 4.6.5 | **4.6.7** | S1 (direct) |
| body-parser | 1.20.8 | **1.20.9** | S1 (under express 4.22.3) |
| qs | 6.16.0 | **6.16.2** | S1 (under express) |
| ip-address | 10.7.2 | **10.7.6** | S1 (under express-rate-limit / mongodb) |
| express | 4.22.3 | 4.22.3 | unchanged (already the latest 4.x) |

**Backend — dev only:** follow-redirects 1.16.0 → 1.16.2.

**Frontend — production graph** (all of it comes in through the vite update; vite is a dev
dependency but reachable from the production dependency `@tailwindcss/vite`)

| Package | Before | After | Why |
| --- | --- | --- | --- |
| vite | 8.3.0 | **8.3.6** | S1 (direct dev dependency) |
| rolldown (vite's bundler) and its 15 platform bindings | 1.2.9 | 1.2.16 | comes with vite 8.3.6 |
| @oxc-project/types | 0.150.0 | 0.156.0 | comes with rolldown |
| postcss | 8.5.28 | 8.5.32 | comes with vite |
| source-map-js | 1.2.1 | **1.2.2** | S1 (under postcss / tailwind) |
| nanoid | 3.3.19 | 3.3.20 | comes with postcss |

**Frontend — dev only:** eslint 10.11.0 → 10.14.0, undici 7.30.0 → 7.30.2.

`package.json` ranges changed: backend `mongoose ^7.8.13`, `multer ^2.5.0`, `zod ^4.6.7`;
frontend `vite ^8.3.6`.

## Files changed

- `backend/package.json`, `backend/package-lock.json` — the updates above and version `1.0.9`.
  The lockfile was written by npm 10, so CI's `npm ci` accepts it.
- `frontend/package.json`, `frontend/package-lock.json` — the same, and version `1.0.11`.
- `.github/workflows/ci.yml` — `audit` job: `continue-on-error: true` and the "allowed to fail
  until Phase 3" comment removed, so the job is required.
- `backend/coverage-thresholds.json` — overall lines floor 75 → **85**.
- `backend/tests/unit/dependencyFloors.test.js`, `frontend/test/unit/dependencyFloors.test.js`
  **(new)**.
- `backend/docs/setup.md`, `backend/AGENTS.md`, `frontend/AGENTS.md` — the dependency-update
  rule (newest release at least two weeks old, `--before`, npm 10, update the floor tests) and the
  audit job being required.
- `backend/docs/TEST-CASES.md` — rows U-90, U-91 and FU-24; counts; the S1 gaps row.
- The review checklist — S1 ticked.

No source code changed. No new routes, models or environment variables.

## Tests added

FIX-PLAN: "no new behaviour, so the whole existing suite is the check". All of it ran on the new
versions (results below). Each side also gets a floor test, so a lockfile regenerated without
these versions fails with the advisory named:

**Unit (backend):** `dependencyFloors.test.js`
- S1: the version comparison orders releases numerically
- S1: production dependencies are at or above their patched versions — mongoose, multer, zod,
  body-parser, qs, ip-address

**Unit (frontend):** `dependencyFloors.test.js`
- S1: vite and source-map-js are at or above their patched versions

**Proof:** both were written first and **failed on the old versions**, listing all eight, e.g.
"mongoose 7.8.12 is below 7.8.13 (GHSA-gg4r-jv3p-qx3c, …)" and "vite 8.3.0 is below 8.3.3
(GHSA-587h-7wmj-h5pm and 5 more)". They pass after the update.

**Traceability:** U-90, U-91, FU-24, mapped to "— (deployment safety)": none of the SRS SE-x
requirements covers third-party vulnerabilities. The traceability test validates the table.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 21 Nov 2026, on the **new** dependency versions.
Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 91, pass 91, fail 0 | 0 |
| backend `test:integration` | tests 56, suites 12, pass 56, fail 0 | 0 |
| backend `test:security` | tests 59, suites 5, pass 59, fail 0 | 0 |
| backend `test:coverage` | tests 206, pass 206; 91.98% lines / 87.17% branches; floors passed, **overall now 85%** | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 9 passed (9), Tests 28 passed (28) | 0 |
| frontend `test:coverage` | 18.9% lines; thresholds passed | 0 |
| frontend `build` | "vite v8.3.6"; main chunk 526.16 kB (was 526.14 kB) | 0 |
| `e2e` | 12 passed (46.6 s), with the preview built by vite 8.3.6 | 0 |
| backend `npm audit --omit=dev --audit-level=high` | **found 0 vulnerabilities** | **0** |
| frontend `npm audit --omit=dev --audit-level=high` | **found 0 vulnerabilities** | **0** |
| e2e `npm audit --audit-level=high` | 0 | 0 |
| lockfiles | `npx npm@10 ci --dry-run` and `npm ci --dry-run` pass in both packages | 0 |

This is the first phase in which **every row of the gate passes**, the audits included.

### Coverage

| Scope | Phase 2 | Phase 3 | Floor |
| --- | --- | --- | --- |
| Backend overall | 91.98% lines / 87.17% branches | 91.98% / 87.17% (no source change) | **85** (was 75) / 75 |
| `src/services` | 85.65% / 84.45% | unchanged | 80 / 75 |
| `src/middlewares` | 97.91% / 87.41% | unchanged | 80 / 75 |
| `src/utils` | 99.35% / 92.11% | unchanged | 80 / 75 |
| Frontend overall | 18.9% lines | unchanged | 18 |

## How to verify by hand

```sh
git switch fix/phase-3-dependency-updates
cd backend  && npm ci && npm audit --omit=dev --audit-level=high && npm test && npm run test:coverage
cd ../frontend && npm ci && npm audit --omit=dev --audit-level=high && npm test && npm run build
cd ../e2e && npm ci && npm run e2e
npm ls mongoose multer zod body-parser --prefix ../backend      # 7.8.13 / 2.5.0 / 4.6.7 / 1.20.9
npm ls vite source-map-js --prefix ../frontend                 # 8.3.6 / 1.2.2
```

## Not done, and deviations from the plan

1. **mongoose 7.8.13, not "latest 7.x" (7.8.14).** That was your planning choice of settled
   releases: 7.8.13 fixes all four advisories and was 28 days old; 7.8.14 was 4 days old. Vite is
   8.3.6 rather than 8.3.8 for the same reason.
2. **Dev-only advisories are not fixed** (they're outside the `--omit=dev` gate FIX-PLAN sets).
   What remains:
   - **frontend `react-snap`** (direct dev dependency): **every remaining high (14) and
     critical (3)**, plus 3 lows. The criticals are react-snap itself and the `mkdirp@0.5.1` /
     `minimist@0.0.8` it pins to exact versions; the highs come through puppeteer 1.20, express
     4.16, cheerio and others it pins. npm labels the pinned ones "fixable", but they can't move
     without changing react-snap (checked with `npm ls`). npm's only fix for react-snap is a
     semver-major *downgrade* to 1.13.1, and the package is unmaintained. It's used
     only by the manual `npm run snap` prerender, not by `npm run build`, so nothing of it ships.
     **Decision needed later:** remove it, or replace it with a maintained prerenderer.
   - **frontend `eslint` 10.14.0**: a moderate `minimatch` advisory whose fix was published after
     the two-week cutoff. It will clear with the next settled eslint release.
   - **backend `c8`** (with `glob`, `minimatch`, `test-exclude`) and **`nodemon`**: 5 moderate.
     npm's suggested `c8` fix is a semver-major change, and nodemon's fix is newer than the cutoff.
     Both are test/dev tools.

## Known risks

1. **Vite's bundler changed version** (rolldown 1.2.9 → 1.2.16) along with vite. The build output
   is effectively unchanged (526.14 → 526.16 kB), and unit, integration and all 12 E2E tests pass
   on it, but it is the most consequential transitive change here.
2. **multer 2.4 → 2.5 is a minor release.** The upload integration and security suites (sizes,
   types, temp clean-up, 413s) all pass on it.
3. **Now that the audit job is required, a new advisory in any production dependency turns CI red**
   until someone updates it. That is the point of S1, but it means CI can fail on an unchanged
   branch. The fix procedure is in `backend/docs/setup.md` and both `AGENTS.md` files.
4. **`--before` shaped only this resolution.** A later plain `npm install` may pull newer versions;
   the committed lockfile pins these, and the floor tests guard the minimums.

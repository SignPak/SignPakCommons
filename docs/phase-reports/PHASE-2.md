# Phase 2 – Storage reliability (C5, B1, B6, B8, D3)

## Phase and branch

| | |
| --- | --- |
| Phase | 2 – Storage reliability (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-2-storage-reliability` (from `main` @ `53343f5`, Phase 1 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.7 → 1.0.8`; frontend unchanged (no frontend code changed) |

Backend only. No route, model or environment variable was added, so the access matrix is
unchanged.

## Checklist items

| ID | State | How |
| --- | --- | --- |
| **C5** | **Done, ticked** | `storageService.save()` and `archive()` delete the temp file in a `finally` (safe for the local driver, which has already moved it). At startup the local driver deletes temp files more than an hour old. Go-live check pending: a production upload leaves `uploads/tmp` empty. |
| **B1** | **Done, ticked** | New `src/utils/cleanup.js` `attemptCleanup()`: each clean-up step runs on its own, a failure is logged and the next step still runs, and the **original** error is rethrown. Used in `submissionService.create` (the cooldown is always released), `videoService.create` and `demoVideoService.upload`. |
| **B6** | **Done, ticked** | `sniffVideo` checks brands, as you chose during planning: a rejected major brand (M4A/M4B audio, HEIC/HEIX/MIF1/MSF1/AVIF images, any 3GP/3G2) is refused; a listed major brand is accepted; an unknown major brand passes only through a listed compatible brand within the box and the first 32 bytes, with no rejected one alongside. |
| **B8** | **Done, ticked** | `folderIdFor` caches the in-flight lookup *promise* per path, so concurrent uploads share one list-or-create. A rejected lookup is evicted so it can be retried. |
| **D3** | Code done; **team action pending** | Any storage failure or `init()` failure matching Google's `invalid_grant` logs "Google Drive refresh token expired or revoked; make sure the OAuth app is In production and create a new token", with `driver` and the variable to `replace`. Documented in `setup.md` and `deploy/README.md` §13. Switching the OAuth app to "In production" is the team's step, so that checklist line stays unticked with a note. |
| Leftover: clean-up | **Done, ticked** | The `console.error('UPLOAD ERROR…')` in `videoController.create` is gone; the Drive driver uses `utils/parseCredentials.js` and its own copy is deleted. |

## Found while doing it

1. **A correction to Phase 1.** The Phase 1 plan, its report (known risk 3) and the health docs
   said the Drive driver "has no `init()`", so `storage: true` "doesn't prove the token works".
   **That was wrong.** `googleDriveDriver.init()` reads the root folder through the Drive API, so
   `storage: true` does prove the OAuth token worked at startup; only a token revoked afterwards
   goes unseen until the next upload. Corrected in `src/controllers/healthController.js`, the
   `openapi.js` health description and `ARCHITECTURE.md`. It also means D3's `invalid_grant`
   usually appears at startup, which the setup docs now say.
2. **Replacing the demo video could delete the new video.** `demoVideoService.upload` removed the
   *old* file inside the `try`, after `demoVideoRepo.replace()` had already pointed the database
   at the new one. If that removal failed, the `catch` deleted the **new** file. The old file is
   now removed after the replacement, best-effort and logged. Covered by unit and integration
   tests named `B1:`.
3. **`utils/parseCredentials.js` could never parse double-encoded JSON**, despite its comment
   saying it could. It stripped wrapping `"` quotes before parsing, which turns
   `"{\"a\":1}"` into invalid JSON. The deleted copy in the Drive driver had the same flaw, so
   this isn't a regression. Since the driver now depends on the utility, it parses first,
   unwraps a JSON string, and strips quotes only when the raw value isn't JSON.
4. **The local driver stays independent of the app's environment.** The startup sweep needs a
   logger; importing the app logger would have pulled in `env.js` and broken
   `localStorage.test.js`, which imports the driver before setting up the environment. The
   logger is now passed in by `storage/index.js` instead.
5. **Upload-wrapping errors keep their cause.** The Drive driver wraps upload failures in a new
   `Error`; it now passes `{ cause: err }`, so `invalid_grant` is recognisable through the wrapper
   as well as from the message text.

## Files changed

**Backend — source**
- `src/services/storage/index.js` — the C5 `finally`; `isInvalidGrant`, `INVALID_GRANT_MESSAGE`
  and the D3 logging in `throwStorageError` and `init()`; the `routeStorageForTests()` test seam
  (throws unless `NODE_ENV=test`); the local driver gets the app logger.
- `src/services/storage/localDriver.js` — `STALE_TEMP_MS` and the startup sweep, with the
  logger injected.
- `src/services/storage/googleDriveDriver.js` — B8 promise cache (`findOrCreateFolder` /
  `folderIdFor`); uses `parseServiceAccountCredentials`; local parser deleted; `cause` on
  wrapped upload errors.
- `src/utils/files.js` — B6 brand rules (`ftypBrands`, allow and reject lists).
- `src/utils/cleanup.js` **(new)** — `attemptCleanup()`.
- `src/utils/parseCredentials.js` — double-encoded path fixed (finding 3).
- `src/services/submissionService.js`, `src/services/videoService.js`,
  `src/services/demoVideoService.js` — B1.
- `src/controllers/videoController.js` — stray `console.error` removed.
- `src/controllers/healthController.js`, `src/docs/openapi.js` — the health/Drive correction.
- `package.json` / lock — `1.0.8`.
- `coverage-thresholds.json` — `src/services` lines floor 78 → **80** (FIX-PLAN target reached;
  the "target" note removed).

**Backend — tests:** see *Tests added*.

**Docs:** `backend/docs/ARCHITECTURE.md` (upload lifecycle, B1/B6/B8/D3, the correction),
`backend/docs/setup.md` (`UPLOAD_DIR`, the new "Keep the Google OAuth app In production" section
with the exact log line), `backend/docs/MODULE-REFERENCE.md`, `backend/docs/TEST-CASES.md`,
`deploy/README.md` §13, the review checklist.

## Tests added

Every checklist item has a regression test named with its ID. Each fix was proven by a
**failing test first**, or by putting the old code back temporarily:

| Fix | Proof that the tests catch the bug |
| --- | --- |
| B6 | the 4 new-behaviour tests in `sniffVideo.test.js` failed before the fix |
| B6 security | the 3 tests failed on the old `sniffVideo` (`git show HEAD:…/files.js`) |
| B8 | failed before the fix: **10 folder creations instead of 4** for three simultaneous uploads |
| B1 | all 5 unit tests failed before the fix |
| C5 | with the two new `removeQuietly(tempPath)` lines taken out, 3 unit tests and 4 integration tests failed |

**Unit (backend, 28 new)**
- `sniffVideo.test.js`:
  - B6: accepts every listed video major brand
  - B6: rejects audio, image and 3GP major brands even when they list video brands
  - B6: an unknown major brand is accepted only through a listed compatible brand
  - B6: a rejected compatible brand vetoes an unknown major brand
  - B6: compatible brands past the end of the ftyp box are ignored
  - B6: box size 0 (box runs to end of file) and short files are handled
  - B6: WebM is still recognised and other content is still rejected
- `storageService.test.js`:
  - C5: removes the temp file after a Drive upload
  - C5: removes the temp file after a Drive archive (contributor recording)
  - C5: removes the temp file when the Drive upload fails, too
  - D3: an invalid_grant from Drive logs the clear refresh-token message
  - D3: an invalid_grant while initializing storage logs the message and still fails startup
  - D3: other storage failures do not mention the refresh token
  - D3: invalid_grant is recognised in the shapes googleapis produces
  - the storage test seam refuses to run outside NODE_ENV=test
- `googleDriveDriver.test.js` (the real driver with `google.drive` replaced by an in-process
  stand-in; no network):
  - B8: concurrent uploads to the same folder path create each Drive folder exactly once
  - B8: sibling paths share their common parent folders
  - B8: a failed folder lookup is retried by the next upload, not cached
  - the Drive driver reads service-account JSON through utils/parseCredentials.js
  - the Drive driver still names itself when no credentials are configured
  - parseServiceAccountCredentials accepts quoted and double-encoded JSON and fixes key newlines
- `cleanupOrder.test.js`:
  - B1: a failing file removal still releases the submission cooldown and rethrows the original error
  - B1: a failing cooldown release is logged and does not hide the original error
  - B1: one failing removal does not stop the others, and video create rethrows the original error
  - B1: a failing rollback of the new demo video rethrows the original error
  - B1: a failed removal of the previous demo file keeps the new demo video
- `localStorage.test.js` (extended):
  - C5: startup removes temp files older than an hour and keeps newer files and subfolders
  - C5: the startup sweep is a no-op on an empty or missing temp folder

**Integration (backend, 7 new):** `api-storage-drive.test.js` runs the real app with Google
Drive as storage, as in production, using `tests/support/fakeDriveDriver.js` through
`routeStorageForTests()`. This is the Phase 0 fake driver's first real use.
- C5: removes the temp file after a Drive upload of a reference video and its poster
- C5: removes the temp file after a Drive upload of a contributor recording
- C5: removes the temp file after a Drive upload of the demo video
- B1: when the database write and the Drive clean-up both fail, the original error is returned
  and the cooldown is released. The client gets the real 500 rather than the clean-up's 502,
  and an immediate retry succeeds.
- B1: a failed removal of the previous demo video keeps the new one playable
- B6: .m4a and .3gp recordings are rejected with 422 and nothing is stored
- C5: old temp files are cleared when storage initializes at startup

**Security (backend, 3 new):** `upload-types.test.js` (FIX-PLAN 4.5, "wrong file types
rejected"). Seven disguises are labelled `video/mp4` and named `.mp4`: M4A, HEIC, AVIF, 3GP, 3G2,
plain text and JPEG.
- B6: disguised files are rejected on the contributor recording route
- B6: disguised files are rejected on the reference video route
- B6: disguised files are rejected on the demo video route

**Traceability:** 38 new rows (U-62–U-89, I-50–I-56, S-11–S-13); the traceability test
validates every row. No existing test was changed, skipped or weakened; the existing fixtures
use `isom`/`qt  ` major brands and pass unchanged.

**E2E:** no changes (FIX-PLAN lists none for this phase, and the E2E server uses local storage).
The existing suite was re-run.

### Mistakes in my own new tests, caught and fixed before commit

- `await` inside two non-async arrow functions (a syntax error).
- An unrealistic credential format ("quoted with backslash-escaped quotes") in the parser test.
- In the integration test, the storage restore was registered with `after()` *inside* a
  `before()` hook, which node:test runs as soon as the hook finishes. That silently sent later
  uploads back to local storage. It's now a file-level hook. Two tests failed until this was
  fixed; they then passed with the Drive routing active throughout, and failed again when the
  C5 fix was taken out.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 21 Nov 2026, pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 89, pass 89, fail 0 | 0 |
| backend `test:integration` | tests 56, suites 12, pass 56, fail 0 | 0 |
| backend `test:security` | tests 59, suites 5, pass 59, fail 0 | 0 |
| backend `test:coverage` | tests 204, pass 204; floors passed (table below) | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 8 passed (8), Tests 27 passed (27) | 0 |
| frontend `test:coverage` | 18.9% lines; thresholds passed | 0 |
| frontend `build` | built; main chunk 526.14 kB | 0 |
| `e2e` | 12 passed (1.5 m) | 0 |
| backend audit | 6 vulnerabilities (2 moderate, 4 high) | 1 (expected until Phase 3) |
| frontend audit | 2 high | 1 (expected until Phase 3) |

### Coverage

| Scope | Phase 1 | Phase 2 | Floor | FIX-PLAN target |
| --- | --- | --- | --- | --- |
| Backend overall | 87.82% lines / 85.92% branches | **91.98% / 87.17%** | 75 / 75 | 75 lines |
| `src/services` | 78.52% / 82.61% | **85.65% / 84.45%** | **80** (was 78) / 75 | 80 / 75 — **met** |
| `src/middlewares` | 97.91% / 86.52% | **97.91% / 87.41%** | 80 / 75 | 80 / 75 |
| `src/utils` | 86.43% / 89.29% | **99.35% / 92.11%** | 80 / 75 | 80 / 75 |
| Frontend overall | 18.9% lines | 18.9% (unchanged) | 18 | 70 |

All three backend directory targets from FIX-PLAN 4.6 are now met.

### CI

Run [44801123374](https://github.com/SignPak/SignPakCommons/actions/runs/44801123374) on
`13076bf`, overall **success**:

| Job | Result |
| --- | --- |
| Backend | pass 89 / 56 / 59; 204 under coverage; "Coverage gate passed." |
| Frontend | success |
| End-to-end | "12 passed (36.7s)" |
| Deploy files | success |
| Dependency audit | failure, tolerated until Phase 3 |

## Go-live check (pending, joins Phase 1's list)

- [ ] After a production upload, `uploads/tmp` on the server is empty.

## How to verify by hand

```sh
git switch fix/phase-2-storage-reliability
cd backend && npm ci && npm run test:unit && npm run test:integration && npm run test:security && npm run test:coverage
```

Spot checks:
1. **C5:** `npm run dev`, upload a reference video as admin, then list `backend/uploads/tmp`:
   it's empty. With local storage this was already true; the Drive case is what
   `api-storage-drive.test.js` covers.
2. **Startup sweep:** put a file in `backend/uploads/tmp`, set its modified time two hours back,
   then restart the API: the file is gone.
3. **B6:** try to upload an `.m4a` or an iPhone `.heic` renamed to `.mp4` as a reference video:
   you get 422 "That does not look like an MP4, WebM or MOV video."
4. **D3:** start the API with `STORAGE_DRIVER=gdrive` and a deliberately wrong
   `GOOGLE_OAUTH_REFRESH_TOKEN`. Initialization fails, health shows `"storage":false`, and the
   log shows the "refresh token expired or revoked" line with `driver: "gdrive"`.

## Not done, and deviations from the plan

1. **B6 follows your planning choice:** major brand first, then compatible brands. That accepts
   slightly more than a literal "only these brands" reading (genuine camera clips with an odd
   major brand); rejected brands always win.
2. **Two additions beyond the FIX-PLAN list:** the demo-video old-file fix (finding 2) and the
   `parseCredentials.js` double-encoded fix (finding 3).
3. **`routeStorageForTests()` is a test seam in a production module.** It's what lets the
   integration tests run on the fake Drive driver without Google credentials. It throws unless
   `NODE_ENV=test`, and a test proves it.
4. **The frontend version is not bumped,** because no frontend file changed.

## Known risks

1. **The startup sweep deletes temp files more than an hour old.** A live upload keeps a fresh
   modified time and Nginx caps a request at 300 s. It runs only when storage initializes, at
   startup, and for idempotent re-inits.
2. **`isInvalidGrant` matches the error shapes googleapis produces today** (response data,
   message text, `cause` chain). If googleapis changes them, the clear line would stop
   appearing, but the error would still be logged and thrown as before.
3. **D3's real fix is a team action:** setting the OAuth consent screen to In production. Until
   then, Drive tokens expire every 7 days; the new log line only makes that obvious.
4. **The 32-byte read covers up to four compatible brands.** A file whose only listed video
   brand comes fifth or later is refused (422) rather than accepted. That fails safe, and real
   encoders put `isom`/`mp42` first.

# Test-case inventory and traceability

Every automated test in the project, mapped to the requirement it covers and the review
checklist item it guards. This table is the source for Section 9 of the SRS/final report.

- **Requirements** are SRS identifiers. A row cites a requirement only when the test
  asserts that behaviour directly:
  - **FR13.x** — the contribution-site functional requirements.
  - **OR-19** — the consent notice.
  - **UI 3.1.1.3** — the public landing page. **QA-3** — service availability (health).
  - **SE-1** role-based access control · **SE-2** sessions, JWT and logout ·
    **SE-3** password hashing · **SE-4** login lockout · **SE-6** data separation between
    contributors · **SE-9** the API requires a valid token · **SE-10** server-side input
    validation.
  - **—** with a note marks a test that guards something the SRS does not specify: *test
    infrastructure* (the fake Drive driver and the capture email store), *deployment safety*
    (test-only switches that must never reach production) or *API metadata*.
- **Checklist** is the ID from `docs/SignPakCommons review checklist.md` (C1–C5, S1–S10,
  B1–B8), or `—` when a test covers behaviour that was already correct.
- **Level** is unit, integration, security or E2E, matching the layout in
  `docs/FIX-PLAN.md` section 4.1.

Counts as of **Phase 2** (backend 1.0.8, frontend 1.0.10):

| Level | Where | Files | Cases |
| --- | --- | ---: | ---: |
| Unit (backend) | `backend/tests/unit/` | 18 | 89 |
| Integration (backend) | `backend/tests/integration/` | 12 | 56 |
| Security (backend) | `backend/tests/security/` | 5 | 59 |
| Unit (frontend) | `frontend/test/unit/` | 7 | 23 |
| Integration (frontend) | `frontend/test/integration/` | 1 | 4 |
| End-to-end | `e2e/tests/` | 3 | 12 (4 tests × 3 browsers) |
| **Total** | | **46** | **243** |

The backend security count is per-route: the access matrix produces one case per route (47
today) plus the completeness check; the hook suite adds three, the production-error suite
three, the listen-address suite two and the upload-type suite three.

## 1. Backend unit tests — `backend/tests/unit/`

| ID | Test file | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| U-01 | `safeName.test.js` | safeName uses its fallback for nullish and blank values | FR13.8 | — | unit |
| U-02 | `safeName.test.js` | safeName replaces reserved path characters and collapses whitespace | FR13.8, SE-10 | — | unit |
| U-03 | `safeName.test.js` | safeName caps its output at 100 characters | FR13.8, SE-10 | — | unit |
| U-04 | `localStorage.test.js` | local driver stores named files in folders and appends suffixes on collisions | FR13.8 | — | unit |
| U-05 | `localStorage.test.js` | local driver handles named files without an extension and dotfiles | FR13.8 | — | unit |
| U-06 | `localStorage.test.js` | local driver generates unique UUID keys when no file name is supplied | FR13.8 | — | unit |
| U-07 | `localStorage.test.js` | local driver rejects paths escaping the storage root and keeps the source file | FR13.8, SE-10 | — | unit |
| U-08 | `localStorage.test.js` | local driver stat reports missing files and remove is idempotent | FR13.8 | — | unit |
| U-09 | `localStorage.test.js` | storageService forwards named folder and file name to the local driver | FR13.8 | — | unit |
| U-10 | `videoService.test.js` | video create names video and poster from title and category safely | FR13.11 | — | unit |
| U-11 | `videoService.test.js` | video create uses Unassigned and Untitled fallbacks when optional labels are absent | FR13.11 | — | unit |
| U-12 | `videoService.test.js` | video create selects detected video and image extensions | FR13.11, SE-10 | — | unit |
| U-13 | `videoService.test.js` | video create rejects a missing upload, unsupported content, and invalid categories before storage | FR13.11, SE-10 | — | unit |
| U-14 | `videoService.test.js` | poster metadata is cached in Redis for five minutes | FR13.11 | — | unit |
| U-15 | `videoService.test.js` | video create rejects oversized or unsupported posters before storage | FR13.7, SE-10 | — | unit |
| U-16 | `videoService.test.js` | video create accepts a poster exactly at the size limit | FR13.7 | — | unit |
| U-17 | `videoService.test.js` | video create surfaces filesystem errors instead of reporting invalid video content | FR13.11 | — | unit |
| U-18 | `videoService.test.js` | video create removes already stored files when poster storage fails | FR13.8 | B1 (partly) | unit |
| U-19 | `videoService.test.js` | video create removes video and poster if the database write fails | FR13.8 | B1 (partly) | unit |
| U-20 | `fakeDriveDriver.test.js` | fake Drive driver exposes the same interface as the real Google Drive driver | — (test infrastructure, no SRS requirement) | — | unit |
| U-21 | `fakeDriveDriver.test.js` | fake Drive driver stores bytes under an opaque key and leaves the temp file alone | — (test infrastructure, no SRS requirement) | C5 (fixture) | unit |
| U-22 | `fakeDriveDriver.test.js` | fake Drive driver reuses one folder id per path and creates nested folders once | — (test infrastructure, no SRS requirement) | B8 (fixture) | unit |
| U-23 | `fakeDriveDriver.test.js` | fake Drive driver supports byte ranges and idempotent removal | — (test infrastructure, no SRS requirement) | — | unit |
| U-24 | `fakeDriveDriver.test.js` | fake Drive driver can be told to fail on save, stat and remove | — (test infrastructure, no SRS requirement) | B1 (fixture) | unit |
| U-25 | `emailDriver.test.js` | the capture driver records recipient, purpose and code without sending anything | — (test infrastructure, no SRS requirement) | — | unit |
| U-26 | `emailDriver.test.js` | captured codes can be filtered by recipient and purpose, newest first | — (test infrastructure, no SRS requirement) | — | unit |
| U-27 | `emailDriver.test.js` | the capture store keeps only the last 100 codes and can be cleared | — (test infrastructure, no SRS requirement) | — | unit |
| U-28 | `emailDriver.test.js` | the test environment selects the capture driver and brevo stays the default elsewhere | — (deployment safety, no SRS requirement) | — | unit |
| U-29 | `emailDriver.test.js` | authService sends its codes through the email driver | FR13.1 | — | unit |
| U-30 | `env-guards.test.js` | a valid production configuration starts with brevo mail and no test hooks | — (deployment safety, no SRS requirement) | — | unit |
| U-31 | `env-guards.test.js` | production refuses to start with E2E_TEST_HOOKS enabled | — (deployment safety, no SRS requirement) | — | unit |
| U-32 | `env-guards.test.js` | production refuses to start with the capture email driver | — (deployment safety, no SRS requirement) | — | unit |
| U-33 | `env-guards.test.js` | an unknown email driver is rejected in every environment | — (deployment safety, no SRS requirement) | — | unit |
| U-34 | `env-guards.test.js` | test environments may enable the hooks and the capture driver | — (deployment safety, no SRS requirement) | — | unit |
| U-35 | `traceability.test.js` | TEST-CASES.md has one well-formed row per test ID | — (test infrastructure, no SRS requirement) | — | unit |
| U-36 | `traceability.test.js` | TEST-CASES.md cites only requirement IDs the SRS defines | — (test infrastructure, no SRS requirement) | — | unit |
| U-37 | `traceability.test.js` | every row in TEST-CASES.md points at a test that exists | — (test infrastructure, no SRS requirement) | — | unit |
| U-38 | `initialization.test.js` | S5: production 503 bodies carry no detail | — (deployment safety, no SRS requirement) | S5 | unit |
| U-39 | `initialization.test.js` | S5: development 503 bodies keep the detail for debugging | — (deployment safety, no SRS requirement) | S5 | unit |
| U-40 | `initialization.test.js` | S5: a missing error still gives a well-formed body | — (deployment safety, no SRS requirement) | S5 | unit |
| U-41 | `startupChecks.test.js` | S3: warns when TRUST_PROXY is off in production | — (deployment safety, no SRS requirement) | S3 | unit |
| U-42 | `startupChecks.test.js` | S3: no proxy warning in production when TRUST_PROXY is on | — (deployment safety, no SRS requirement) | S3 | unit |
| U-43 | `startupChecks.test.js` | S3: no proxy warning outside production | — (deployment safety, no SRS requirement) | S3 | unit |
| U-44 | `gracefulShutdown.test.js` | C1: shutdown stops accepting requests, closes MongoDB and exits 0 | QA-3 | C1 | unit |
| U-45 | `gracefulShutdown.test.js` | C1: a second signal during shutdown is ignored | QA-3 | C1 | unit |
| U-46 | `gracefulShutdown.test.js` | C1: shutdown forces exit 1 when draining takes too long | QA-3 | C1 | unit |
| U-47 | `gracefulShutdown.test.js` | C1: a failure while closing exits 1 instead of hanging | QA-3 | C1 | unit |
| U-48 | `healthController.test.js` | C1: health is ok only when the database and storage are both up | QA-3 | C1 | unit |
| U-49 | `healthController.test.js` | C1: health exposes booleans and counters only | QA-3 | C1 | unit |
| U-50 | `requestLog.test.js` | S3: request logs record the client IP Express resolved, not the proxy socket | — (deployment safety, no SRS requirement) | S3 | unit |
| U-51 | `requestLog.test.js` | S3: request logs fall back to the socket address when req.ip is unavailable | — (deployment safety, no SRS requirement) | S3 | unit |
| U-52 | `deployConfig.test.js` | C1: nginx config sets the body limit, unbuffered uploads, timeouts and forwarding headers | FR13.7, QA-3 | C1, S3 | unit |
| U-53 | `deployConfig.test.js` | C1: nginx body limit leaves room above the API upload limit | FR13.7 | C1 | unit |
| U-54 | `deployConfig.test.js` | C1: PM2 runs exactly one fork-mode process | QA-3 | C1, S3 | unit |
| U-55 | `deployConfig.test.js` | C1: deploy.sh stops on errors and fails unless health reports ok | QA-3 | C1 | unit |
| U-56 | `deployConfig.test.js` | C1: deploy files name api.commons.signpak.tech and commons.signpak.tech, with no placeholders left | — (deployment safety, no SRS requirement) | C1 | unit |
| U-57 | `deployConfig.test.js` | C1: the production env template is a valid production configuration once filled in | — (deployment safety, no SRS requirement) | C1, C4, S3 | unit |
| U-58 | `listenHost.test.js` | S3: production listens on 127.0.0.1 by default, so only Nginx can reach Node | FR13.12 | S3 | unit |
| U-59 | `listenHost.test.js` | S3: development and test listen on 0.0.0.0 by default | FR13.12 | S3 | unit |
| U-60 | `listenHost.test.js` | S3: an explicit HOST wins in every environment | FR13.12 | S3 | unit |
| U-61 | `listenHost.test.js` | S3: a blank HOST is rejected instead of silently meaning "all interfaces" | FR13.12 | S3 | unit |
| U-62 | `sniffVideo.test.js` | B6: accepts every listed video major brand | FR13.8, SE-10 | B6 | unit |
| U-63 | `sniffVideo.test.js` | B6: rejects audio, image and 3GP major brands even when they list video brands | FR13.8, SE-10 | B6 | unit |
| U-64 | `sniffVideo.test.js` | B6: an unknown major brand is accepted only through a listed compatible brand | FR13.8, SE-10 | B6 | unit |
| U-65 | `sniffVideo.test.js` | B6: a rejected compatible brand vetoes an unknown major brand | FR13.8, SE-10 | B6 | unit |
| U-66 | `sniffVideo.test.js` | B6: compatible brands past the end of the ftyp box are ignored | FR13.8, SE-10 | B6 | unit |
| U-67 | `sniffVideo.test.js` | B6: box size 0 (box runs to end of file) and short files are handled | FR13.8, SE-10 | B6 | unit |
| U-68 | `sniffVideo.test.js` | B6: WebM is still recognised and other content is still rejected | FR13.8, SE-10 | B6 | unit |
| U-69 | `storageService.test.js` | C5: removes the temp file after a Drive upload | FR13.8 | C5 | unit |
| U-70 | `storageService.test.js` | C5: removes the temp file after a Drive archive (contributor recording) | FR13.8 | C5 | unit |
| U-71 | `storageService.test.js` | C5: removes the temp file when the Drive upload fails, too | FR13.8 | C5 | unit |
| U-72 | `storageService.test.js` | D3: an invalid_grant from Drive logs the clear refresh-token message | FR13.8 | — | unit |
| U-73 | `storageService.test.js` | D3: an invalid_grant while initializing storage logs the message and still fails startup | FR13.8 | — | unit |
| U-74 | `storageService.test.js` | D3: other storage failures do not mention the refresh token | FR13.8 | — | unit |
| U-75 | `storageService.test.js` | D3: invalid_grant is recognised in the shapes googleapis produces | FR13.8 | — | unit |
| U-76 | `storageService.test.js` | the storage test seam refuses to run outside NODE_ENV=test | — (deployment safety, no SRS requirement) | — | unit |
| U-77 | `googleDriveDriver.test.js` | B8: concurrent uploads to the same folder path create each Drive folder exactly once | FR13.8 | B8 | unit |
| U-78 | `googleDriveDriver.test.js` | B8: sibling paths share their common parent folders | FR13.8 | B8 | unit |
| U-79 | `googleDriveDriver.test.js` | B8: a failed folder lookup is retried by the next upload, not cached | FR13.8 | B8 | unit |
| U-80 | `googleDriveDriver.test.js` | the Drive driver reads service-account JSON through utils/parseCredentials.js | FR13.8 | — | unit |
| U-81 | `googleDriveDriver.test.js` | the Drive driver still names itself when no credentials are configured | FR13.8 | — | unit |
| U-82 | `googleDriveDriver.test.js` | parseServiceAccountCredentials accepts quoted and double-encoded JSON and fixes key newlines | FR13.8 | — | unit |
| U-83 | `cleanupOrder.test.js` | B1: a failing file removal still releases the submission cooldown and rethrows the original error | FR13.8, FR13.9 | B1 | unit |
| U-84 | `cleanupOrder.test.js` | B1: a failing cooldown release is logged and does not hide the original error | FR13.8, FR13.9 | B1 | unit |
| U-85 | `cleanupOrder.test.js` | B1: one failing removal does not stop the others, and video create rethrows the original error | FR13.11 | B1 | unit |
| U-86 | `cleanupOrder.test.js` | B1: a failing rollback of the new demo video rethrows the original error | FR13.11 | B1 | unit |
| U-87 | `cleanupOrder.test.js` | B1: a failed removal of the previous demo file keeps the new demo video | FR13.11 | B1 | unit |
| U-88 | `localStorage.test.js` | C5: startup removes temp files older than an hour and keeps newer files and subfolders | FR13.8 | C5 | unit |
| U-89 | `localStorage.test.js` | C5: the startup sweep is a no-op on an empty or missing temp folder | FR13.8 | C5 | unit |

## 2. Backend integration tests — `backend/tests/integration/`

Each file uses `tests/support/apiContext.js`: the real Express app, a fresh in-memory
MongoDB, local storage in a temporary folder, captured email and a recording contact sender.

| ID | Test file | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| I-01 | `api-basics.test.js` | root advertises the API and favicon is ignored | — (API metadata, no SRS requirement) | — | integration |
| I-02 | `api-basics.test.js` | health check reports the database | QA-3 | — | integration |
| I-03 | `api-basics.test.js` | public landing stats return aggregate counts without authentication | UI 3.1.1.3 | B2 (to extend) | integration |
| I-04 | `api-basics.test.js` | unknown routes and bad JSON use the error shape | SE-10 | — | integration |
| I-05 | `api-basics.test.js` | cross-origin writes are refused, allowed origin passes | SE-9 | — | integration |
| I-06 | `api-auth.test.js` | signup validates every field | FR13.1, SE-10 | — | integration |
| I-07 | `api-auth.test.js` | signup only creates an account after consent and never leaks the hash or accepts a role | FR13.1, OR-19, SE-1, SE-2, SE-3 | — | integration |
| I-08 | `api-auth.test.js` | password reset codes are one-time and replace the old password | FR13.1, SE-3 | — | integration |
| I-09 | `api-auth.test.js` | duplicate emails conflict, case-insensitively | FR13.1 | B3 (to change) | integration |
| I-10 | `api-auth.test.js` | login: wrong password and unknown email give the same answer | FR13.1 | — | integration |
| I-11 | `api-auth.test.js` | session, logout and tampered cookies | SE-2 | S6 (to extend) | integration |
| I-12 | `api-auth.test.js` | the env admin exists once, has the admin role, and re-running is harmless | FR13.12, SE-1 | S7 (to extend) | integration |
| I-13 | `api-auth.test.js` | admin-only routes reject contributors and visitors | FR13.12, SE-1, SE-9 | — | integration |
| I-14 | `api-consent.test.js` | creates the account only after consent and records the acceptance time | OR-19 | — | integration |
| I-15 | `api-consent.test.js` | declining consent discards the unfinished signup | OR-19 | — | integration |
| I-16 | `api-consent.test.js` | legacy accounts without consent cannot submit until they accept | OR-19 | — | integration |
| I-17 | `api-profile-connections.test.js` | normalises, validates, and disconnects | FR13.10, SE-9, SE-10 | — | integration |
| I-18 | `api-categories.test.js` | only admins write; names are unique regardless of case | FR13.2, FR13.11, SE-1, SE-10 | — | integration |
| I-19 | `api-categories.test.js` | update and public listing | FR13.2, FR13.11, SE-10 | — | integration |
| I-20 | `api-videos.test.js` | upload needs a real video file | FR13.11, SE-1, SE-10 | B6 (to extend) | integration |
| I-21 | `api-videos.test.js` | admin uploads with and without a poster; the API hides storage internals | FR13.11 | — | integration |
| I-22 | `api-videos.test.js` | admin can register a direct HTTPS video URL with a stored poster | FR13.11 | — | integration |
| I-23 | `api-videos.test.js` | external video URLs require HTTPS and a poster, and cannot be combined with an upload | FR13.11, SE-10 | — | integration |
| I-24 | `api-videos.test.js` | visibility: contributors and visitors only see published, categorised videos | FR13.2, FR13.11, SE-1 | — | integration |
| I-25 | `api-videos.test.js` | published files stream publicly with Range support | FR13.3, SE-1 | — | integration |
| I-26 | `api-videos.test.js` | posters are served as images | FR13.3 | — | integration |
| I-27 | `api-videos.test.js` | editing: moving categories appends to the end of that path | FR13.11, SE-1, SE-10 | — | integration |
| I-28 | `api-demo-video.test.js` | admins can upload, replace, and delete the public demo video | FR13.11, SE-1 | — | integration |
| I-29 | `api-submissions.test.js` | archive and database failures release cooldown and remove any archived file | FR13.8, FR13.9 | B1 | integration |
| I-30 | `api-submissions.test.js` | input is checked before anything is stored | FR13.6, FR13.7, SE-9, SE-10 | — | integration |
| I-31 | `api-submissions.test.js` | a valid submission is stored and listed | FR13.8, SE-6 | — | integration |
| I-32 | `api-submissions.test.js` | COOLDOWN: a second submission for the same video, too soon, is refused and stores nothing | FR13.9 | — | integration |
| I-33 | `api-submissions.test.js` | COOLDOWN: concurrent double-submits for the same video produce exactly one submission | FR13.9 | — | integration |
| I-34 | `api-submissions.test.js` | COOLDOWN: once it elapses, the same video can be submitted again, as a new, separate recording | FR13.9 | — | integration |
| I-35 | `api-submissions.test.js` | a submission can never be edited, deleted, or read once archived | FR13.8 | — | integration |
| I-36 | `api-submissions.test.js` | deleting a base video keeps contributors' submissions on record | FR13.8, FR13.11 | — | integration |
| I-37 | `api-admin-stats-contact.test.js` | stats add up | FR13.12, SE-1 | B7 (to extend) | integration |
| I-38 | `api-admin-stats-contact.test.js` | deleting a category unassigns its videos instead of deleting them | FR13.11 | — | integration |
| I-39 | `api-admin-stats-contact.test.js` | contact delivery requires matching account email, enforces quotas, and blocks abusive devices | FR13.13, SE-1, SE-10 | S4 (to change) | integration |
| I-40 | `api-admin-stats-contact.test.js` | oversized uploads are rejected with 413 | FR13.7, SE-10 | — | integration |
| I-41 | `api-admin-user-controls.test.js` | suspending a user blocks its existing session and login; reactivation restores access | FR13.12, SE-2 | — | integration |
| I-42 | `api-admin-user-controls.test.js` | contributors can delete their account without removing submitted recordings | FR13.13, SE-2 | C3 (to change) | integration |
| I-43 | `api-admin-user-controls.test.js` | admin deletion removes the account and cooldowns but retains submissions and recordings | FR13.12 | C3 (to change) | integration |
| I-44 | `api-admin-user-controls.test.js` | device restrictions reject matching IDs, expose only a hint, and can be removed | FR13.12 | S10 | integration |
| I-45 | `api-admin-user-controls.test.js` | IP restrictions block API traffic while admin routes remain available for recovery | FR13.12 | — | integration |
| I-46 | `api-basics.test.js` | C1: health reports database and storage status | QA-3 | C1 | integration |
| I-47 | `api-basics.test.js` | S3: without TRUST_PROXY a forged X-Forwarded-For is ignored | FR13.12 | S3 | integration |
| I-48 | `api-basics.test.js` | C4: the session cookie is host-only, HttpOnly and SameSite=Lax | SE-2 | C4 | integration |
| I-49 | `api-proxy.test.js` | S3: with TRUST_PROXY=true the client IP comes from X-Forwarded-For | FR13.12 | S3 | integration |
| I-50 | `api-storage-drive.test.js` | C5: removes the temp file after a Drive upload of a reference video and its poster | FR13.8, FR13.11 | C5 | integration |
| I-51 | `api-storage-drive.test.js` | C5: removes the temp file after a Drive upload of a contributor recording | FR13.8 | C5 | integration |
| I-52 | `api-storage-drive.test.js` | C5: removes the temp file after a Drive upload of the demo video | FR13.11 | C5 | integration |
| I-53 | `api-storage-drive.test.js` | B1: when the database write and the Drive clean-up both fail, the original error is returned and the cooldown is released | FR13.8, FR13.9 | B1 | integration |
| I-54 | `api-storage-drive.test.js` | B1: a failed removal of the previous demo video keeps the new one playable | FR13.11 | B1 | integration |
| I-55 | `api-storage-drive.test.js` | B6: .m4a and .3gp recordings are rejected with 422 and nothing is stored | FR13.8, SE-10 | B6 | integration |
| I-56 | `api-storage-drive.test.js` | C5: old temp files are cleared when storage initializes at startup | FR13.8 | C5 | integration |

## 3. Backend security tests — `backend/tests/security/`

| ID | Test file | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| S-01 | `access-matrix.test.js` | `<METHOD> <path>` enforces its access rules (one case per registered route) | FR13.12, SE-1, SE-9 | — | security |
| S-02 | `access-matrix.test.js` | every registered route has a matrix entry | SE-1, SE-9 | — | security |
| S-03 | `test-hooks.test.js` | E2E_TEST_HOOKS is off in this environment | — (deployment safety, no SRS requirement) | — | security |
| S-04 | `test-hooks.test.js` | GET /__test/emails does not exist without E2E_TEST_HOOKS | — (deployment safety, no SRS requirement) | — | security |
| S-05 | `test-hooks.test.js` | the router stack contains no /__test route | — (deployment safety, no SRS requirement) | — | security |
| S-06 | `production-errors.test.js` | S5: the production 503 has no detail and does not echo the error | — (deployment safety, no SRS requirement) | S5 | security |
| S-07 | `production-errors.test.js` | S5: every route answers with the same generic body while initialization fails | — (deployment safety, no SRS requirement) | S5 | security |
| S-08 | `production-errors.test.js` | C1: the production health check reports the failure as booleans only | QA-3 | C1, S5 | security |
| S-09 | `listen-address.test.js` | S3: the production server answers on loopback, where Nginx connects | FR13.12 | S3 | security |
| S-10 | `listen-address.test.js` | S3: the production server refuses connections on the machine's network addresses | FR13.12 | S3 | security |
| S-11 | `upload-types.test.js` | B6: disguised files are rejected on the contributor recording route | FR13.8, SE-10 | B6 | security |
| S-12 | `upload-types.test.js` | B6: disguised files are rejected on the reference video route | FR13.11, SE-10 | B6 | security |
| S-13 | `upload-types.test.js` | B6: disguised files are rejected on the demo video route | FR13.11, SE-10 | B6 | security |

The matrix in S-01 calls every route as an anonymous visitor, a contributor, a suspended
contributor and an admin. A denied caller must get the exact status (401 or 403); an allowed
caller only has to get past the guards. S-02 compares the table with the live router stack, so
a new route cannot be added without an access decision.

## 4. Frontend unit tests — `frontend/test/unit/`

| ID | Test file | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| FU-01 | `limits.test.js` | accepts a recording exactly at both limits | FR13.7 | — | unit |
| FU-02 | `limits.test.js` | rejects a recording longer than ten minutes | FR13.7 | — | unit |
| FU-03 | `limits.test.js` | rejects a recording larger than the configured upload limit | FR13.7 | — | unit |
| FU-04 | `AuthValidation.test.jsx` | shows Zod field errors on signup and does not submit invalid values | FR13.1 | — | unit |
| FU-05 | `AuthValidation.test.jsx` | validates auth API payloads before sending a request | FR13.1 | — | unit |
| FU-06 | `AuthValidation.test.jsx` | maps API validation errors back to the corresponding login field | FR13.1 | — | unit |
| FU-07 | `RecorderPanel.test.jsx` | prepares the camera and starts capture after the three-second countdown | FR13.4 | — | unit |
| FU-08 | `RecorderPanel.test.jsx` | does not start a countdown when camera preparation fails | FR13.4 | — | unit |
| FU-09 | `RecorderPanel.test.jsx` | shows a live recording status and lets the user stop recording | FR13.4 | — | unit |
| FU-10 | `RecorderPanel.test.jsx` | shows a notice when the recorder automatically stops at a limit | FR13.4, FR13.7 | — | unit |
| FU-11 | `RecorderPanel.test.jsx` | lets the user review, delete, or save a finished take | FR13.5 | — | unit |
| FU-12 | `RecorderPanel.test.jsx` | displays camera errors and disables start while a request is pending | FR13.4 | — | unit |
| FU-13 | `UploadQueueProvider.test.jsx` | refuses oversized recordings before uploading | FR13.7 | — | unit |
| FU-14 | `UploadQueueProvider.test.jsx` | refuses recordings longer than ten minutes before uploading | FR13.7 | — | unit |
| FU-15 | `UploadQueueProvider.test.jsx` | serializes two queued uploads and retries a failure | FR13.8 | — | unit |
| FU-16 | `UploadQueueProvider.test.jsx` | shows the remaining cooldown time from a rejected upload in the toast | FR13.9 | — | unit |
| FU-17 | `ProfileDeletion.test.jsx` | warns that recordings remain and requires the current password in its confirmation dialog | FR13.13, OR-19 | C3 (context) | unit |
| FU-18 | `AdminVideos.test.jsx` | requires an explicit poster image or auto-frame choice | FR13.11 | — | unit |
| FU-19 | `AdminVideos.test.jsx` | uploads a selected poster image instead of the auto-generated frame | FR13.11 | — | unit |
| FU-20 | `AdminVideos.test.jsx` | adds a direct HTTPS video URL with a required poster instead of uploading video bytes | FR13.11 | — | unit |
| FU-21 | `seoCatalog.test.js` | C1: SITE_URL defaults to https://commons.signpak.tech | — (deployment safety, no SRS requirement) | C1 | unit |
| FU-22 | `seoCatalog.test.js` | C1: an explicit SITE_URL is used, with a trailing slash trimmed | — (deployment safety, no SRS requirement) | C1 | unit |
| FU-23 | `seoCatalog.test.js` | C1: no longer points at the old signpakcommons.example placeholder | — (deployment safety, no SRS requirement) | C1 | unit |

## 5. Frontend integration tests — `frontend/test/integration/`

Rendered with the real router, providers and API client; only the network is mocked, with MSW.

| ID | Test file | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| FI-01 | `Login.test.jsx` | signs the contributor in and puts the session in the auth provider | FR13.1 | — | integration |
| FI-02 | `Login.test.jsx` | shows the server message when the credentials are refused | FR13.1 | — | integration |
| FI-03 | `Login.test.jsx` | puts field errors from a 422 next to their input | FR13.1 | — | integration |
| FI-04 | `Login.test.jsx` | never reaches the network when the form itself is invalid | FR13.1 | — | integration |

## 6. End-to-end tests — `e2e/tests/`

Playwright, in Chromium, Firefox and WebKit, against the production frontend build and a real
API with an in-memory database.

| ID | Spec | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| E-01 | `landing.spec.js` | loads and shows the public sections without page errors | UI 3.1.1.3 | — | E2E |
| E-02 | `landing.spec.js` | the API the site talks to is healthy through the preview proxy | QA-3 | C1 (fixture) | E2E |
| E-03 | `signup.spec.js` | sign-up: form, emailed code, consent, then the library | FR13.1, OR-19 | — | E2E |
| E-04 | `cross-host-cookie.spec.js` | C4: login cookie set by api.localtest.me works on commons.localtest.me | FR13.1, SE-2 | C4 | E2E |

## 7. Gaps to close in later phases

Phase 0 built the levels; the checklist items themselves are still open. Each phase adds at
least one regression test named with its ID (for example `C5: removes the temp file after a
Drive upload`) and a row here.

| Checklist | Planned coverage | Phase |
| --- | --- | --- |
| C1, C4, S3, S5 | **Covered in Phase 1** (U-38–U-61, I-46–I-49, S-06–S-10, FU-21–FU-23, E-04). The real-server checks are still pending: see `docs/phase-reports/PHASE-1.md`. | 1 |
| C5, B1, B6, B8 | **Covered in Phase 2** (U-62–U-89, I-50–I-56, S-11–S-13). Real-server check pending: a production upload leaves `uploads/tmp` empty. | 2 |
| S1 | the whole suite re-run on updated dependencies; the audit job becomes required | 3 |
| C2, S4 | contact form sends, deletion request with an emailed code, per-sender quotas | 4 |
| C3 | recording deletion for one contributor, deletion log, admin messages page | 5 |
| S2, S6, S9, B2, B3, B4 | login lockout, logout invalidating the JWT, unverified-signup expiry, verified-only counts, re-signup, consent token in sessionStorage | 6 |
| S7 | admin list promotion/demotion and the activity log | 7 |
| B5, B7 | submissions export (CSV/JSON) and paginated admin data | 8 |
| S8, S10 | CSP and security headers, `X-Request-Id` validation, axe checks | 9 |
| all | final traceability check: every FR13.x and checklist ID has a test | 10 |

## 8. Running the suites

```sh
cd backend  && npm run test:unit && npm run test:integration && npm run test:security
cd backend  && npm run test:coverage     # c8 + the floors in coverage-thresholds.json
cd frontend && npm run lint && npm test && npm run test:coverage && npm run build
cd e2e      && npm run e2e               # one-off first: npx playwright install
```

See [setup.md](./setup.md) section 8 for the fixtures and environment each level uses, and
`docs/FIX-PLAN.md` section 4.6 for the full gate.

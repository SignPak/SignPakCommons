# Test-case inventory and traceability

Every automated test in the project, mapped to the requirement it covers and the review
checklist item it guards. This table is the source for Section 9 of the SRS/final report.

- **Requirements** are SRS identifiers. A row cites a requirement only when the test
  asserts that behaviour directly:
  - **FR13.x** — the contribution-site functional requirements.
  - **OR-19** — the consent notice.
  - **UI 3.1.1.3** — the public landing page. **QA-3** — service availability (health).
    **QA-20** — accessibility (SRS C.3): no serious WCAG 2.1 AA problem.
  - **SE-1** role-based access control · **SE-2** sessions, JWT and logout ·
    **SE-3** password hashing · **SE-4** login lockout · **SE-6** data separation between
    contributors · **SE-9** the API requires a valid token · **SE-10** server-side input
    validation.
  - **—** with a note marks a test that guards something the SRS does not specify: *test
    infrastructure* (the fake Drive driver and the capture email store), *deployment safety*
    (test-only switches that must never reach production), *API metadata*, *browser
    hardening* (the site's CSP and security headers, S8), *bundle size*, *deploy updates* (a
    tab opened before a deploy reloads once for the new build's chunks), *documentation* (the
    OpenAPI spec and env docs match the code), *API client* (requests and responses of
    `frontend/src/services/api.js` with no user-visible behaviour of their own) or *frontend
    helpers* (small formatting and validation functions).
- **Checklist** is the ID from `docs/SignPakCommons review checklist.md` (C1–C5, S1–S10,
  B1–B8), or `—` when a test covers behaviour that was already correct.
- **Level** is unit, integration, security or E2E, matching the layout in
  `docs/FIX-PLAN.md` section 4.1.

Counts as of **Phase 11** (backend 1.0.17, frontend 1.0.18):

| Level | Where | Files | Cases |
| --- | --- | ---: | ---: |
| Unit (backend) | `backend/tests/unit/` | 40 | 222 |
| Integration (backend) | `backend/tests/integration/` | 24 | 167 |
| Security (backend) | `backend/tests/security/` | 8 | 82 |
| Unit (frontend) | `frontend/test/unit/` | 18 | 94 |
| Integration (frontend) | `frontend/test/integration/` | 10 | 124 |
| End-to-end | `e2e/tests/` | 16 | 93 (31 tests × 3 browsers; the editor's axe check, the record flow and the upload limit run in Chromium only) |
| **Total** | | **116** | **782** |

The backend security count is per-route: the access matrix produces one case per route (58
today) plus the completeness check; the hook suite adds three, the production-error suite
three, the listen-address suite two, the upload-type suite three, the contact-verification
suite four, the admin-deletion suite two and the JWT suite six. Frontend cases count each `it.each` row separately.

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
| U-90 | `dependencyFloors.test.js` | S1: the version comparison orders releases numerically | — (deployment safety, no SRS requirement) | S1 | unit |
| U-91 | `dependencyFloors.test.js` | S1: production dependencies are at or above their patched versions | — (deployment safety, no SRS requirement) | S1 | unit |
| U-92 | `otp.test.js` | generateOtp returns six digits, never with a leading zero lost | FR13.1, FR13.13 | — | unit |
| U-93 | `otp.test.js` | a code hash is bound to its purpose and subject | FR13.1, FR13.13 | — | unit |
| U-94 | `otp.test.js` | matchesOtp accepts only the right code for the right purpose and subject | FR13.1, FR13.13 | — | unit |
| U-95 | `otp.test.js` | matchesOtp is false without a stored hash or with a malformed one | FR13.1, FR13.13 | — | unit |
| U-96 | `contactRules.test.js` | S4: a signed-out general message is refused with 403 before any quota is touched | FR13.13 | S4 | unit |
| U-97 | `contactRules.test.js` | S4: a signed-in message from another email is refused with 403 | FR13.13 | S4 | unit |
| U-98 | `contactRules.test.js` | S4: the site-wide cap answers 429 and releases the user quota it claimed | FR13.13 | S4 | unit |
| U-99 | `contactRules.test.js` | S4: deletion requests never touch the site-wide cap | FR13.13 | S4 | unit |
| U-100 | `contactRules.test.js` | S4: signed-out deletion requests are limited per IP and per device (default two a day) | FR13.13 | S4 | unit |
| U-101 | `contactRules.test.js` | S4: the per-sender keys are keyed hashes, never the raw IP or device ID | FR13.13 | S4 | unit |
| U-102 | `contactRules.test.js` | S4: a failed forward removes the message and releases every quota it claimed | FR13.13 | S4 | unit |
| U-103 | `contactRules.test.js` | D4: a signed-in deletion request is verified at once and skips the one-a-day quota | FR13.13 | S4 | unit |
| U-104 | `contactRules.test.js` | D4: a signed-out deletion request is saved unverified with a send time, and forwarded as pending | FR13.13 | S4 | unit |
| U-105 | `contactRules.test.js` | D4: a code is emailed when an account uses the email, and none otherwise | FR13.13 | S4 | unit |
| U-106 | `contactRules.test.js` | D4: the send answer is identical with and without an account | FR13.13 | S4 | unit |
| U-107 | `contactRules.test.js` | D4: the right code verifies the request and clears the code | FR13.13 | S4 | unit |
| U-108 | `contactRules.test.js` | D4: an expired code is refused with the generic 400 | FR13.13 | S4 | unit |
| U-109 | `contactRules.test.js` | D4: the fifth wrong attempt clears the code | FR13.13 | S4 | unit |
| U-110 | `contactRules.test.js` | D4: an unknown id, a non-deletion message and a request with no code all give the same 400 | FR13.13 | S4 | unit |
| U-111 | `contactRules.test.js` | D4: resend waits a minute after the last send, then claims the send time and answers the same for everyone | FR13.13 | S4 | unit |
| U-112 | `contactRules.test.js` | D4: resend is refused for signed-in or verified requests | FR13.13 | S4 | unit |
| U-113 | `contactSchemas.test.js` | C2: the contact body accepts the three topics and defaults to general | FR13.13, SE-10 | C2 | unit |
| U-114 | `contactSchemas.test.js` | C2: the contact body refuses an unknown topic, a bad email, and empty or oversized fields | FR13.13, SE-10 | C2 | unit |
| U-115 | `contactSchemas.test.js` | D4: the code body takes exactly six digits | FR13.13, SE-10 | S4 | unit |
| U-116 | `contactSchemas.test.js` | D4: a NoSQL operator object is not a code | FR13.13, SE-10 | S4 | unit |
| U-117 | `contactSchemas.test.js` | D4: the message id must be a 24-character object id | FR13.13, SE-10 | S4 | unit |
| U-118 | `contactRules.test.js` | S4: a signed-out deletion request starts with one code counted | FR13.13 | S4 | unit |
| U-119 | `contactRules.test.js` | S4: a request gets at most five codes, the first included, then resend answers 429 | FR13.13 | S4 | unit |
| U-120 | `contactRules.test.js` | S4: the per-request cap counts and answers the same for an email with no account | FR13.13 | S4 | unit |
| U-121 | `contactRules.test.js` | S4: a resend that loses the race for the send time answers "wait a minute" | FR13.13 | S4 | unit |
| U-122 | `contactRules.test.js` | S4: at most CONTACT_CODE_EMAILS_PER_DAY code emails go to one address a day, across requests | FR13.13 | S4 | unit |
| U-123 | `contactRules.test.js` | S4: a failed code email gives its place in the daily cap back | FR13.13 | S4 | unit |
| U-124 | `emailHash.test.js` | C3: the email hash ignores case and surrounding spaces | FR13.13 | C3 | unit |
| U-125 | `emailHash.test.js` | C3: different addresses get different hashes | FR13.13 | C3 | unit |
| U-126 | `emailHash.test.js` | C3: the hash is keyed, not a plain SHA-256 that an address list could reverse | FR13.13 | C3 | unit |
| U-127 | `emailHash.test.js` | C3: an empty or missing address is refused rather than hashed | FR13.13 | C3 | unit |
| U-128 | `removeAllForUser.test.js` | C3: every file and document is removed, and the counts are returned | FR13.13 | C3 | unit |
| U-129 | `removeAllForUser.test.js` | C3: keeps going after one failed file, and keeps that file's document for a retry | FR13.13 | C3 | unit |
| U-130 | `removeAllForUser.test.js` | C3: writes a deletion log with the counts and the email hash, never the email | FR13.13 | C3 | unit |
| U-131 | `removeAllForUser.test.js` | C3: for an account already deleted, the hash comes from its DeletedAccount record | FR13.13 | C3 | unit |
| U-132 | `removeAllForUser.test.js` | C3: with no submissions, no account and no deleted-account record, the user is not found | FR13.13 | C3 | unit |
| U-133 | `removeAllForUser.test.js` | C3: accountDeleted is never logged before the account deletion has happened | FR13.13 | C3 | unit |
| U-134 | `adminDeletionSchemas.test.js` | C3: the submissions page takes a limit of 1-100 (default 20) and an object-id cursor | FR13.13, SE-10 | C3 | unit |
| U-135 | `adminDeletionSchemas.test.js` | C3: withRecordings accepts only "true" or "false" and defaults to false | FR13.13, SE-10 | C3 | unit |
| U-136 | `adminDeletionSchemas.test.js` | C3: message filters accept only known topics, statuses and true/false | FR13.13, SE-10 | C3 | unit |
| U-137 | `adminDeletionSchemas.test.js` | C3: the deletion lookup needs exactly one of email or message id | FR13.13, SE-10 | C3 | unit |
| U-138 | `env-guards.test.js` | C3: production refuses to start without EMAIL_HASH_SECRET, or with a short one | — (deployment safety, no SRS requirement) | C3 | unit |
| U-139 | `env-guards.test.js` | C3: outside production an empty EMAIL_HASH_SECRET falls back to the development key | — (deployment safety, no SRS requirement) | C3 | unit |
| U-140 | `requestLog.test.js` | C3: an email in the query string is redacted from the logged URL | FR13.13 | C3 | unit |
| U-141 | `lockout.test.js` | S2: the defaults are 5 attempts and 15 minutes | SE-4 | S2 | unit |
| U-142 | `lockout.test.js` | S2: four wrong passwords are plain 401s, the fifth locks the account | SE-4 | S2 | unit |
| U-143 | `lockout.test.js` | S2: while locked even the right password is refused | SE-4 | S2 | unit |
| U-144 | `lockout.test.js` | S2: once the lock has passed the right password works and clears it | SE-4 | S2 | unit |
| U-145 | `lockout.test.js` | S2: after a lock has passed, the count starts again from zero | SE-4 | S2 | unit |
| U-146 | `lockout.test.js` | S2: a successful login resets the count | SE-4 | S2 | unit |
| U-147 | `lockout.test.js` | S2: an unknown email still runs bcrypt (timing) and is never locked | SE-4 | S2 | unit |
| U-148 | `userIndexes.test.js` | S9: the TTL index removes a document as soon as signupExpiresAt passes, 24 h after sign-up | FR13.1 | S9 | unit |
| U-149 | `userIndexes.test.js` | S9: the partial filter matches only unverified contributor accounts | FR13.1 | S9 | unit |
| U-150 | `userIndexes.test.js` | S9: the expiry is never sent to a client | FR13.1 | S9 | unit |
| U-151 | `userIndexes.test.js` | B2: countVerified counts only accounts that finished sign-up | UI 3.1.1.3, FR13.12 | B2 | unit |
| U-152 | `userIndexes.test.js` | codes last 10 minutes by default (FIX-PLAN section 0) | FR13.1 | — | unit |
| U-153 | `consentToken.test.js` | B3: the token carries the version as claim v, and verifying returns it | FR13.1, SE-9 | B3 | unit |
| U-154 | `consentToken.test.js` | B3: a tampered or wrong-purpose token is rejected | FR13.1, SE-9 | B3 | unit |
| U-155 | `consentToken.test.js` | B3: pendingSignup accepts a token for the current version | FR13.1, SE-9 | B3 | unit |
| U-156 | `consentToken.test.js` | B3: pendingSignup refuses a token from before a re-signup (mismatched v) | FR13.1, SE-9 | B3 | unit |
| U-157 | `consentToken.test.js` | B3: a token without v (issued before this change) counts as version 0 | FR13.1, SE-9 | B3 | unit |
| U-158 | `pendingSignupRepo.test.js` | B3: versionMatch(0) also matches an account with no authVersion field; other versions match exactly | FR13.1, SE-9 | B3 | unit |
| U-159 | `pendingSignupRepo.test.js` | B3: updatePendingSignup only updates an unfinished user sign-up at the expected version, bumps the version and selects the code fields | FR13.1, SE-9 | B3 | unit |
| U-160 | `pendingSignupRepo.test.js` | B3: completePendingSignup only finishes an unfinished user sign-up at the token's version | FR13.1, SE-9 | B3 | unit |
| U-161 | `pendingSignupRepo.test.js` | B3: removePendingSignup deletes only an unfinished user sign-up at the token's version | FR13.1, SE-9 | B3 | unit |
| U-162 | `adminSync.test.js` | S7: verified accounts on the list become admins; an unverified one does not | FR13.12, SE-1 | S7 | unit |
| U-163 | `adminSync.test.js` | S7: admins not on the list go back to normal users | FR13.12, SE-1 | S7 | unit |
| U-164 | `adminSync.test.js` | S7: the ADMIN_EMAIL account is never demoted, even when ADMIN_EMAILS leaves it out | FR13.12, SE-1 | S7 | unit |
| U-165 | `adminSync.test.js` | S7: the last active admin is never demoted | FR13.12, SE-1 | S7 | unit |
| U-166 | `adminSync.test.js` | S7: a suspended admin off the list is demoted even when it is not the last | FR13.12, SE-1 | S7 | unit |
| U-167 | `adminSync.test.js` | S7: each promotion and demotion writes one audit entry with the system as actor | FR13.12, SE-1 | S7 | unit |
| U-168 | `adminSync.test.js` | S7: nothing changes when the accounts already match the list | FR13.12, SE-1 | S7 | unit |
| U-169 | `auditService.test.js` | S7: meta drops password, token, secret, hash, code, email, cookie and OTP keys | FR13.12, SE-1 | S7 | unit |
| U-170 | `auditService.test.js` | S7: meta keeps only primitive values, cuts long strings and keeps at most 10 keys | FR13.12, SE-1 | S7 | unit |
| U-171 | `auditService.test.js` | S7: record writes the actor, action, target and cleaned meta | FR13.12, SE-1 | S7 | unit |
| U-172 | `auditService.test.js` | S7: a failed write is logged and does not fail the admin action | FR13.12, SE-1 | S7 | unit |
| U-173 | `loginLog.test.js` | S7: a successful login is logged with the email hash, the IP and outcome success | SE-2 | S7 | unit |
| U-174 | `loginLog.test.js` | S7: a wrong password is logged as wrong-password | SE-2 | S7 | unit |
| U-175 | `loginLog.test.js` | S7: an unknown email is logged as unknown-email | SE-2 | S7 | unit |
| U-176 | `loginLog.test.js` | S7: a locked, suspended or unverified account is logged with that outcome | SE-2 | S7 | unit |
| U-177 | `env-guards.test.js` | S7: ADMIN_EMAILS is optional; ADMIN_EMAIL is always on the admin list | FR13.12, SE-1 | S7 | unit |
| U-178 | `env-guards.test.js` | S7: ADMIN_EMAILS is split on commas, trimmed, lowercased and de-duplicated | FR13.12, SE-1 | S7 | unit |
| U-179 | `env-guards.test.js` | S7: an entry in ADMIN_EMAILS that is not an email stops the server from starting | FR13.12, SE-1 | S7 | unit |
| U-180 | `accountDeletionLog.test.js` | Phase 7 item 5: the log is marked accountDeleted only after the account is deleted | FR13.13 | C3 | unit |
| U-181 | `accountDeletionLog.test.js` | Phase 7 item 5: when the account deletion fails, the log is never marked | FR13.13 | C3 | unit |
| U-182 | `accountDeletionLog.test.js` | Phase 7 item 5: a plain account deletion writes no deletion log | FR13.13 | C3 | unit |
| U-183 | `csv.test.js` | B5: plain values are written as they are | FR13.6, FR13.8 | B5 | unit |
| U-184 | `csv.test.js` | B5: a comma, a quote or a line break is quoted, and quotes are doubled | FR13.6, FR13.8 | B5 | unit |
| U-185 | `csv.test.js` | B5: Urdu text is kept exactly, and quoted only when it holds a comma | FR13.6, FR13.8 | B5 | unit |
| U-186 | `csv.test.js` | B5: null and undefined are empty; numbers and booleans are written plainly | FR13.6, FR13.8 | B5 | unit |
| U-187 | `csv.test.js` | B5: a row ends with CRLF, and the file starts with a UTF-8 BOM so Excel reads Urdu correctly | FR13.6, FR13.8 | B5 | unit |
| U-188 | `statsBuckets.test.js` | B7: one entry per day, and a day with no submissions is 0 | FR13.12 | B7 | unit |
| U-189 | `statsBuckets.test.js` | B7: submissions are counted on their UTC day, across the midnight boundary | FR13.12 | B7 | unit |
| U-190 | `statsBuckets.test.js` | B7: dates before the first day or after the last are left out | FR13.12 | B7 | unit |
| U-191 | `statsBuckets.test.js` | B7: the number of entries is the number of days asked for | FR13.12 | B7 | unit |
| U-192 | `prepareDataset.test.js` | B5: a trim seeks to trimStart and keeps trimEnd - trimStart seconds, without audio | FR13.6 | B5 | unit |
| U-193 | `prepareDataset.test.js` | B5: a mirrored recording is flipped horizontally | FR13.6 | B5 | unit |
| U-194 | `prepareDataset.test.js` | B5: decimal trims keep millisecond precision and no floating-point noise | FR13.6 | B5 | unit |
| U-195 | `prepareDataset.test.js` | B5: a trim that is empty or reversed is refused | FR13.6 | B5 | unit |
| U-196 | `prepareDataset.test.js` | B5: the output is <category>/<video>/<submissionId>.mp4 with safe folder names | FR13.6 | B5 | unit |
| U-197 | `prepareDataset.test.js` | B5: every row is downloaded and converted, and the summary counts them | FR13.6 | B5 | unit |
| U-198 | `prepareDataset.test.js` | B5: a clip that already exists is skipped unless overwrite is set | FR13.6 | B5 | unit |
| U-199 | `prepareDataset.test.js` | B5: a failed row is reported and the run carries on | FR13.6 | B5 | unit |
| U-200 | `deleteAccountOrder.test.js` | Phase 8 item 6: the user is removed first, then the DeletedAccount record is written | FR13.13 | C3 | unit |
| U-201 | `deleteAccountOrder.test.js` | Phase 8 item 6: when the removal fails, no DeletedAccount record is written | FR13.13 | C3 | unit |
| U-202 | `deleteAccountOrder.test.js` | Phase 8 item 6: a failed DeletedAccount write after the removal is logged, not thrown | FR13.13 | C3 | unit |
| U-203 | `prepareDataset.test.js` | B5: FFMPEG_PATH wins over everything, as an override | FR13.6 | B5 | unit |
| U-204 | `prepareDataset.test.js` | B5: without FFMPEG_PATH, the ffmpeg-static binary when it is installed and on disk | FR13.6 | B5 | unit |
| U-205 | `prepareDataset.test.js` | B5: falls back to ffmpeg on PATH when ffmpeg-static is missing, unsupported or not downloaded | FR13.6 | B5 | unit |
| U-206 | `prepareDataset.test.js` | B5: the not-found message says npm install is enough, and names a broken FFMPEG_PATH | FR13.6 | B5 | unit |
| U-207 | `requestId.test.js` | S10: a valid id (letters, digits, hyphens, up to 64 characters) is kept as sent | SE-10 | S10 | unit |
| U-208 | `requestId.test.js` | S10: an id that is too long, empty or has any other character is replaced with a new UUID | SE-10 | S10 | unit |
| U-209 | `requestId.test.js` | S10: no header, or a repeated header (an array), gets a new UUID | SE-10 | S10 | unit |
| U-210 | `docsSync.test.js` | Docs: every API route is in the OpenAPI spec | — (documentation, no SRS requirement) | — | unit |
| U-211 | `docsSync.test.js` | Docs: every environment variable is in .env.example, .env.production.example and setup.md | — (documentation, no SRS requirement) | — | unit |
| U-212 | `traceability.test.js` | every FR13.x requirement and every checklist ID has at least one test | — (test infrastructure, no SRS requirement) | — | unit |
| U-213 | `httpServer.test.js` | D1: the server gets REQUEST_TIMEOUT_MS as requestTimeout; headersTimeout and keepAliveTimeout keep Node's defaults | FR13.8 | C1 (D1, Phase 11) | unit |
| U-214 | `httpServer.test.js` | D1: REQUEST_TIMEOUT_MS defaults to 15 minutes, takes a value, and refuses 0, text and values under 60 s | FR13.8 | C1 (D1, Phase 11) | unit |
| U-215 | `startupChecks.test.js` | D1: in a container, a loopback HOST in production is warned about | — (deployment safety, no SRS requirement) | C1, S3 (D1, Phase 11) | unit |
| U-216 | `deployConfig.test.js` | D1: the Dockerfile builds a slim production image of Node 22 that runs as the node user | QA-3 | C1 (D1, Phase 11) | unit |
| U-217 | `deployConfig.test.js` | D1: .dockerignore sends only the app: no tests, .env files, node_modules, coverage, uploads or scripts | — (deployment safety, no SRS requirement) | C1 (D1, Phase 11) | unit |
| U-218 | `deployConfig.test.js` | D1: the Coolify guide comes first and names the settings the API depends on | FR13.8, QA-3 | C1, S3 (D1, Phase 11) | unit |
| U-219 | `deployConfig.test.js` | D1: CI builds and checks the image, and deploys only from main, after every other job, through a POST webhook | QA-3 | C1 (D1, Phase 11) | unit |
| U-220 | `healthController.test.js` | D1: liveness answers 503 only when the database is down; storage is reported but never fails it | QA-3 | C1 (D1, Phase 11) | unit |
| U-221 | `requestLog.test.js` | D1: both health checks are left out of the request log, and nothing else is | — (deployment safety, no SRS requirement) | C1 (D1, Phase 11) | unit |
| U-222 | `deployConfig.test.js` | D1: the image health check uses /health/live, so a storage failure never takes the API offline | QA-3 | C1 (D1, Phase 11) | unit |

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
| I-39 | `api-admin-stats-contact.test.js` | contact delivery requires matching account email and enforces quotas; S4: refusals never block the device | FR13.13, SE-1, SE-10 | S4 | integration |
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
| I-57 | `api-contact.test.js` | S4: a signed-out general message gets 403 and the device is not blocked afterwards | FR13.13 | S4 | integration |
| I-58 | `api-contact.test.js` | S4: a signed-in message from another email gets 403 and the device is not blocked | FR13.13 | S4 | integration |
| I-59 | `api-contact.test.js` | S4: the site-wide cap answers 429 without blocking, and deletion requests are exempt from it | FR13.13 | S4 | integration |
| I-60 | `api-contact.test.js` | S4: two signed-out deletion requests a day per IP; the third gets 429 and nothing is blocked | FR13.13 | S4 | integration |
| I-61 | `api-contact.test.js` | S4: a failed forward releases the sender quota | FR13.13 | S4 | integration |
| I-62 | `api-contact.test.js` | D4: a signed-out request for an account is saved unverified, a code is emailed, and the code verifies it | FR13.13 | S4 | integration |
| I-63 | `api-contact.test.js` | D4: five wrong codes kill the code, so even the right one fails afterwards | FR13.13 | S4 | integration |
| I-64 | `api-contact.test.js` | D4: an expired code is refused | FR13.13 | S4 | integration |
| I-65 | `api-contact.test.js` | D4: resend is refused within a minute of the last send, then sends a new code | FR13.13 | S4 | integration |
| I-66 | `api-contact.test.js` | D4: a signed-in deletion request is verified at once and does not use the one-a-day quota | FR13.13 | S4 | integration |
| I-67 | `api-contact.test.js` | D4: a request for an email with no account sends no code and stays unverified | FR13.13 | S4 | integration |
| I-68 | `api-contact.test.js` | D4: unknown ids and malformed codes are refused | FR13.13 | S4 | integration |
| I-69 | `api-contact.test.js` | D4: the admin inbox shows verified and status, and never the code fields | FR13.13 | S4 | integration |
| I-70 | `api-contact.test.js` | S4: the sixth code for one request is refused and no sixth email is sent | FR13.13 | S4 | integration |
| I-71 | `api-contact.test.js` | S4: requests from different IPs for the same address stop at five code emails a day | FR13.13 | S4 | integration |
| I-72 | `api-contact.test.js` | S4: two simultaneous resends of one request send one email | FR13.13 | S4 | integration |
| I-73 | `api-admin-deletion.test.js` | C3: deleting recordings removes the Drive files and the documents, and logs it without the email | FR13.13 | C3 | integration |
| I-74 | `api-admin-deletion.test.js` | C3: a partial failure is reported, the failed document is kept, and a retry finishes | FR13.13 | C3 | integration |
| I-75 | `api-admin-deletion.test.js` | C3: deleting an account with withRecordings=true removes the recordings too | FR13.13 | C3 | integration |
| I-76 | `api-admin-deletion.test.js` | C3: the account is kept (409) when a recording cannot be deleted | FR13.13 | C3 | integration |
| I-77 | `api-admin-deletion.test.js` | C3: plain account deletion still keeps the recordings, and records the account | FR13.13 | C3 | integration |
| I-78 | `api-admin-deletion.test.js` | C3: a contributor deleting their own account is recorded too | FR13.13 | C3 | integration |
| I-79 | `api-admin-deletion.test.js` | C3: an unknown contributor id gives 404 | FR13.13 | C3 | integration |
| I-80 | `api-admin-deletion.test.js` | C3: the lookup finds a deleted account by email, and by message id, with its recordings | FR13.13 | C3 | integration |
| I-81 | `api-admin-deletion.test.js` | C3: the lookup finds a current account, and both kinds after a re-signup | FR13.13 | C3 | integration |
| I-82 | `api-admin-deletion.test.js` | C3: the lookup needs exactly one of email or message id | FR13.13 | C3 | integration |
| I-83 | `api-admin-deletion.test.js` | C3: a contributor's submissions are listed a page at a time | FR13.13 | C3 | integration |
| I-84 | `api-admin-deletion.test.js` | C3: messages can be filtered by topic, status and verified | FR13.13, SE-1 | C3 | integration |
| I-85 | `api-admin-deletion.test.js` | C3: marking a message done or rejected records who and when; reopening clears it | FR13.13 | C3 | integration |
| I-86 | `api-account-security.test.js` | S2: five wrong passwords lock the account, even against the right password | SE-4 | S2 | integration |
| I-87 | `api-account-security.test.js` | S2: once the lock has passed, logging in works and clears it | SE-4 | S2 | integration |
| I-88 | `api-account-security.test.js` | S2: a successful login resets the count | SE-4 | S2 | integration |
| I-89 | `api-account-security.test.js` | S2: a password reset ends a lockout | SE-4 | S2 | integration |
| I-90 | `api-account-security.test.js` | S6: after logout the old token no longer works, even if replayed | SE-2, SE-9 | S6 | integration |
| I-91 | `api-account-security.test.js` | S6: logging out on one device ends the session on every other device | SE-2, SE-9 | S6 | integration |
| I-92 | `api-account-security.test.js` | S6: logout without a session still answers 204 | SE-2, SE-9 | S6 | integration |
| I-93 | `api-account-security.test.js` | a wrong current password is refused with 401 and changes nothing | SE-2, SE-3 | — | integration |
| I-94 | `api-account-security.test.js` | a mismatched confirmation or the same password is refused with 422 | SE-2, SE-3 | — | integration |
| I-95 | `api-account-security.test.js` | S6: a password change keeps this session, ends every other one, and the new password works | SE-2, SE-9 | S6 | integration |
| I-96 | `api-account-security.test.js` | S9: a new sign-up expires 24 hours later, and finishing it removes the expiry | FR13.1 | S9 | integration |
| I-97 | `api-account-security.test.js` | S9: sign-ups from before the TTL index get an expiry 24 h after they were created | FR13.1 | S9 | integration |
| I-98 | `api-account-security.test.js` | B3: signing up again with an unfinished email succeeds, updates the details and restarts the expiry | FR13.1 | B3 | integration |
| I-99 | `api-account-security.test.js` | B3: the password is checked with the code, so only the person who chose it can finish | FR13.1 | B3 | integration |
| I-100 | `api-account-security.test.js` | B3: a finished account still answers 409 to a new sign-up | FR13.1 | B3 | integration |
| I-101 | `api-account-security.test.js` | codes expire after 10 minutes | FR13.1 | — | integration |
| I-102 | `api-account-security.test.js` | B2: public and admin stats count only contributors who finished sign-up | UI 3.1.1.3, FR13.12 | B2 | integration |
| I-103 | `api-account-security.test.js` | B3: a consent token from before a re-signup is refused, and the other person never gets an account | FR13.1, SE-9 | B3 | integration |
| I-104 | `api-account-security.test.js` | B3: declining with a token from before a re-signup is refused and the sign-up is kept | FR13.1, SE-9 | B3 | integration |
| I-105 | `api-account-security.test.js` | S2: five wrong current passwords lock the account, the session stays, and login is locked too | SE-4 | S2 | integration |
| I-106 | `api-account-security.test.js` | B3: consent that lands while a re-signup is hashing wins; the re-signup gets 409 and changes nothing | FR13.1, SE-9 | B3 | integration |
| I-107 | `api-account-security.test.js` | B3: a re-signup that commits between consent's check and its write wins; consent gets 400 | FR13.1, SE-9 | B3 | integration |
| I-108 | `api-account-security.test.js` | B3: a re-signup that commits between decline's check and its delete wins; decline gets 400 and the sign-up is kept | FR13.1, SE-9 | B3 | integration |
| I-109 | `api-account-security.test.js` | B3: stress, 10 re-signups racing consent: exactly one wins every time and the other person never logs in | FR13.1, SE-9 | B3 | integration |
| I-110 | `api-account-security.test.js` | B3: the conditional writes treat an account with no authVersion field as version 0 | FR13.1, SE-9 | B3 | integration |
| I-111 | `api-admin-audit.test.js` | S7: category create, update and delete | FR13.12, SE-1 | S7 | integration |
| I-112 | `api-admin-audit.test.js` | S7: video create, update and delete | FR13.12, SE-1 | S7 | integration |
| I-113 | `api-admin-audit.test.js` | S7: demo video upload and delete | FR13.12, SE-1 | S7 | integration |
| I-114 | `api-admin-audit.test.js` | S7: user suspend, reactivate and delete | FR13.12, SE-1 | S7 | integration |
| I-115 | `api-admin-audit.test.js` | S7: deleting recordings writes one entry; deleting an account with its recordings writes two | FR13.12, SE-1 | S7 | integration |
| I-116 | `api-admin-audit.test.js` | S7: restriction create and remove, with only the hint and never the raw IP | FR13.12, SE-1 | S7 | integration |
| I-117 | `api-admin-audit.test.js` | S7: changing a message status | FR13.12, SE-1 | S7 | integration |
| I-118 | `api-admin-audit.test.js` | S7: a refused action (404) writes nothing | FR13.12, SE-1 | S7 | integration |
| I-119 | `api-admin-audit.test.js` | S7: the startup sync promotes a listed account, which then acts under its own name, and demotes it when removed from the list | FR13.12, SE-1 | S7 | integration |
| I-120 | `api-admin-audit.test.js` | S7: the log is listed newest first, a page at a time | FR13.12, SE-1 | S7 | integration |
| I-121 | `api-admin-audit.test.js` | S7: the log filters by admin, by the system and by action | FR13.12, SE-1 | S7 | integration |
| I-122 | `api-admin-audit.test.js` | S7: bad filters and page values are refused with 422 | FR13.12, SE-1 | S7 | integration |
| I-123 | `api-admin-audit.test.js` | S7: an admin who has since been deleted is shown as a deleted account | FR13.12, SE-1 | S7 | integration |
| I-124 | `api-admin-audit.test.js` | S7: no entry holds an email address | FR13.12, SE-1 | S7 | integration |
| I-125 | `api-admin-deletion.test.js` | Phase 7 item 5: when the account deletion itself fails, DeletionLog.accountDeleted stays false and the account is kept | FR13.13 | C3 | integration |
| I-126 | `api-admin-submissions.test.js` | B5: lists every submission newest first, with the export fields and the contributor name for the table | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-127 | `api-admin-submissions.test.js` | B5: filters by category, video, contributor and date range | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-128 | `api-admin-submissions.test.js` | B5: cursor paging returns every row exactly once, even when a row is deleted between pages | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-129 | `api-admin-submissions.test.js` | B5: bad filters are refused with 422 | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-130 | `api-admin-submissions.test.js` | B5: the CSV has exactly the export columns, one row per submission, and survives Urdu, commas and quotes | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-131 | `api-admin-submissions.test.js` | B5: the JSON export is an array of objects with the same columns, and honours the filters | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-132 | `api-admin-submissions.test.js` | B5: neither export holds a name or an email address | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-133 | `api-admin-submissions.test.js` | B5: an export with no matching rows is just the header, or an empty array | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-134 | `api-admin-submissions.test.js` | B5: each export writes one activity entry with the format and the filters | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-135 | `api-admin-submissions.test.js` | B5: an unknown format or a bad filter is refused with 422 | FR13.6, FR13.8, SE-1 | B5 | integration |
| I-136 | `api-admin-stats.test.js` | B7: the summary, activity, categories, top lists and recent list cover the chosen days | FR13.12 | B7 | integration |
| I-137 | `api-admin-stats.test.js` | B7: userId narrows everything to one contributor | FR13.12 | B7 | integration |
| I-138 | `api-admin-stats.test.js` | B7: categoryId narrows everything to one category, and the other categories show 0 | FR13.12 | B7 | integration |
| I-139 | `api-admin-stats.test.js` | B7: the existing fields are still there, and totals stay all-time | FR13.12 | B7 | integration |
| I-140 | `api-admin-stats.test.js` | B7: an empty range gives zeros and no top category | FR13.12 | B7 | integration |
| I-141 | `api-admin-stats.test.js` | B7: bad filters are refused with 422 | FR13.12 | B7 | integration |
| I-142 | `api-admin-users-paging.test.js` | B7: without limit the answer is the full array, as before | FR13.12, SE-6 | B7 | integration |
| I-143 | `api-admin-users-paging.test.js` | B7: with limit, pages of { items, nextCursor, total } cover every account exactly once | FR13.12, SE-6 | B7 | integration |
| I-144 | `api-admin-users-paging.test.js` | B7: role and a name or email search narrow the page | FR13.12, SE-6 | B7 | integration |
| I-145 | `api-admin-users-paging.test.js` | B7: regex characters in the search are matched literally | FR13.12, SE-6 | B7 | integration |
| I-146 | `api-admin-users-paging.test.js` | B7: bad paging values are refused with 422 | FR13.12, SE-6 | B7 | integration |
| I-147 | `api-admin-users-paging.test.js` | B7: ?mine=true gives an admin only their own submissions; without it, everyone's as before | FR13.12, SE-6 | B7 | integration |
| I-148 | `api-admin-users-paging.test.js` | B7: ?limit gives the paged shape; a contributor still sees only their own | FR13.12, SE-6 | B7 | integration |
| I-149 | `api-admin-deletion.test.js` | Phase 8 item 6: when removing the account fails, no DeletedAccount record is left and the lookup shows only the current account | FR13.13 | C3 | integration |
| I-150 | `api-admin-export-stream.test.js` | B5: the CSV is the BOM, the header and one CRLF line per row, quoted where needed, oldest first | FR13.6, FR13.8 | B5 | integration |
| I-151 | `api-admin-export-stream.test.js` | B5: the JSON is "[", one row per line separated by commas, then "]" | FR13.6, FR13.8 | B5 | integration |
| I-152 | `api-admin-export-stream.test.js` | B5: an empty result is the BOM and header alone, or exactly "[]" | FR13.6, FR13.8 | B5 | integration |
| I-153 | `api-admin-export-stream.test.js` | B5: the client leaving part-way closes the MongoDB cursor within 2 s, and the next export still works | FR13.6, FR13.8 | B5 | integration |
| I-154 | `api-admin-export-stream.test.js` | B5: a full export of every row still completes | FR13.6, FR13.8 | B5 | integration |
| I-155 | `api-admin-export-stream.test.js` | B5: a database error part-way cuts the download, is logged as an error, and closes the cursor | FR13.6, FR13.8 | B5 | integration |
| I-156 | `prepare-dataset.test.js` | B5: the run makes both clips at category/title/submissionId.mp4, Urdu title included | FR13.6 | B5 | integration |
| I-157 | `prepare-dataset.test.js` | B5: each clip is trimmed to its trimStart–trimEnd: 2.00 s and 5.00 s | FR13.6 | B5 | integration |
| I-158 | `prepare-dataset.test.js` | B5: the mirrored clip is flipped back (red box on the right); the other is not (red on the left) | FR13.6 | B5 | integration |
| I-159 | `prepare-dataset.test.js` | B5: the clips are H.264 MP4 without audio | FR13.6 | B5 | integration |
| I-160 | `api-request-id.test.js` | S10: a valid incoming X-Request-Id is echoed back unchanged | SE-10 | S10 | integration |
| I-161 | `api-request-id.test.js` | S10: an invalid one is never echoed: the response carries a fresh UUID | SE-10 | S10 | integration |
| I-162 | `api-request-id.test.js` | S10: without the header, every response gets its own UUID | SE-10 | S10 | integration |
| I-163 | `requestTimeout.test.js` | D1: an upload slower than REQUEST_TIMEOUT_MS is cut off with 408; one within it gets its response | FR13.8 | C1 (D1, Phase 11) | integration |
| I-164 | `api-health-live.test.js` | D1: /health/live answers 503 when the database is down | QA-3 | C1 (D1, Phase 11) | integration |
| I-165 | `api-health-live.test.js` | D1: with storage failing, /health/live answers 200 with storage false while /health answers 503 | QA-3 | C1 (D1, Phase 11) | integration |
| I-166 | `api-health-live.test.js` | D1: with storage failing, login and browsing still work | FR13.1, QA-3 | C1 (D1, Phase 11) | integration |
| I-167 | `api-health-live.test.js` | D1: the health checks retry storage, and /health is ok once it works again | QA-3 | C1 (D1, Phase 11) | integration |

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
| S-14 | `contact-verification.test.js` | D4: sending a request answers the same, in shape and time, with and without an account | FR13.13 | S4 | security |
| S-15 | `contact-verification.test.js` | D4: a wrong code and a resend answer the same with and without an account | FR13.13 | S4 | security |
| S-16 | `contact-verification.test.js` | D4: a NoSQL operator in place of the code is rejected as invalid input | FR13.13, SE-10 | S4 | security |
| S-17 | `contact-verification.test.js` | D4: the code routes are rate limited separately from the contact form | FR13.13 | S4 | security |
| S-18 | `admin-deletion.test.js` | C3: no DeletionLog or DeletedAccount document contains the email, in any field | FR13.13 | C3 | security |
| S-19 | `admin-deletion.test.js` | C3: query operators are refused in place of an email, an id or a cursor | FR13.13, SE-10 | C3 | security |
| S-20 | `jwt.test.js` | S6: a correctly signed token for the current version is accepted (control) | SE-2, SE-9 | S6 | security |
| S-21 | `jwt.test.js` | S6: a tampered token is rejected | SE-2, SE-9 | S6 | security |
| S-22 | `jwt.test.js` | S6: an expired token is rejected | SE-2, SE-9 | S6 | security |
| S-23 | `jwt.test.js` | S6: an unsigned (alg: none) token is rejected | SE-2, SE-9 | S6 | security |
| S-24 | `jwt.test.js` | S6: the token from before a logout is rejected afterwards | SE-2, SE-9 | S6 | security |
| S-25 | `jwt.test.js` | S6: the token from before a password change is rejected afterwards | SE-2, SE-9 | S6 | security |

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
| FU-24 | `dependencyFloors.test.js` | S1: vite and source-map-js are at or above their patched versions | — (deployment safety, no SRS requirement) | S1 | unit |
| FU-25 | `ContactForm.test.jsx` | C2: a signed-out visitor is offered only the deletion request, with its explanation | FR13.13 | C2 | unit |
| FU-26 | `ContactForm.test.jsx` | C2: a signed-in contributor sees all three topics, general first, with name and email filled in | FR13.13 | C2 | unit |
| FU-27 | `ContactForm.test.jsx` | C2: sending waits until the session check has finished | FR13.13 | C2 | unit |
| FU-28 | `ContactForm.test.jsx` | C2: choosing the deletion topic when signed in explains it is confirmed straight away | FR13.13 | C2 | unit |
| FU-29 | `AdminUsers.test.jsx` | C3: "Delete recordings" confirms with the right count, then deletes them | FR13.12, FR13.13 | C3 | unit |
| FU-30 | `AdminUsers.test.jsx` | C3: nothing is deleted when the admin cancels the confirmation | FR13.12, FR13.13 | C3 | unit |
| FU-31 | `AdminUsers.test.jsx` | C3: "Delete account and recordings" names the count and sends withRecordings | FR13.12, FR13.13 | C3 | unit |
| FU-32 | `AdminUsers.test.jsx` | C3: plain "Delete" says the recordings are kept, and keeps them | FR13.12, FR13.13 | C3 | unit |
| FU-33 | `AdminUsers.test.jsx` | C3: a partial failure is shown, with the number that failed | FR13.12, FR13.13 | C3 | unit |
| FU-34 | `ContactForm.test.jsx` | C2: no field can be filled in until the session check has finished, so nothing typed is lost | FR13.13 | C2 | unit |
| FU-35 | `consentTokenStore.test.js` | B4: a saved token is read back until it expires | FR13.1, OR-19 | B4 | unit |
| FU-36 | `consentTokenStore.test.js` | B4: clear removes it | FR13.1, OR-19 | B4 | unit |
| FU-37 | `consentTokenStore.test.js` | B4: a token without a readable expiry is never stored | FR13.1, OR-19 | B4 | unit |
| FU-38 | `consentTokenStore.test.js` | B4: blocked or corrupt storage falls back to "no token" instead of throwing | FR13.1, OR-19 | B4 | unit |
| FU-39 | `VerifyEmail.test.jsx` | B3: sends the sign-up password with the code | FR13.1 | B3 | unit |
| FU-40 | `VerifyEmail.test.jsx` | B3: the password is required before anything is sent | FR13.1 | B3 | unit |
| FU-41 | `VerifyEmail.test.jsx` | B4: the consent token is saved, so the consent page survives a reload | FR13.1, OR-19 | B4 | unit |
| FU-42 | `VerifyEmail.test.jsx` | B3: a wrong sign-up password from the server is shown next to the password field | FR13.1 | B3 | unit |
| FU-43 | `securityHeaders.test.js` | S8: vercel.json sends exactly securityHeaders() for the production API, on every path | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-44 | `securityHeaders.test.js` | S8: vite preview (the E2E server) sends the same headers | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-45 | `securityHeaders.test.js` | S8: the CSP allows only the site, the API and the listed hosts | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-46 | `securityHeaders.test.js` | S8: no script source allows inline code, eval or a CDN | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-47 | `securityHeaders.test.js` | S8: the other headers | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-48 | `securityHeaders.test.js` | S8: another API origin (the cross-host E2E build) replaces the production one | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-49 | `securityHeaders.test.js` | S8: index.html has no inline script (the theme script is public/theme-init.js) | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-50 | `cspSafeCode.test.js` | S8: a base64 data URL becomes a Blob of the same bytes and type, without fetch | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-51 | `cspSafeCode.test.js` | S8: a percent-encoded (non-base64) data URL is decoded too | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-52 | `cspSafeCode.test.js` | S8: anything that is not a data URL is refused | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-53 | `cspSafeCode.test.js` | S8: isCacheableVideoUrl accepts the site and the API origin, and refuses any other host | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-54 | `cspSafeCode.test.js` | S8: an external video is never fetched: loadVideo rejects at once, so the player streams it | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-55 | `cspSafeCode.test.js` | S8: ffmpeg.load gets the core and wasm from /ffmpeg/ on this origin, never a CDN | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-56 | `cspSafeCode.test.js` | S8: loading a schema module switches Zod to jitless (no new Function under the CSP) | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-57 | `cspSafeCode.test.js` | S8: every schema module gets Zod through src/utils/zod.js, so the setting always applies first | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-58 | `cspSafeCode.test.js` | S8: the saved theme is applied before the app loads, with the matching theme colour | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-59 | `cspSafeCode.test.js` | S8: without a saved theme it follows the system setting | — (browser hardening, no SRS requirement) | S8 | unit |
| FU-60 | `checkBundleSize.test.js` | the limit is 300 kB, as Vite prints sizes (300,000 bytes) | — (bundle size, no SRS requirement) | — | unit |
| FU-61 | `checkBundleSize.test.js` | finds the entry chunk: the module script in index.html, not the theme script or a preload | — (bundle size, no SRS requirement) | — | unit |
| FU-62 | `checkBundleSize.test.js` | passes at the limit and fails one byte over it | — (bundle size, no SRS requirement) | — | unit |
| FU-63 | `AdminVideos.test.jsx` | QA-20: the Quick move select in a video row has an accessible name | QA-20 | — | unit |
| FU-64 | `chunkReload.test.js` | Stale chunks: the first preloadError reloads the page once and stops the error | — (deploy updates, no SRS requirement) | — | unit |
| FU-65 | `chunkReload.test.js` | Stale chunks: another preloadError within 10 s of that reload does not reload again | — (deploy updates, no SRS requirement) | — | unit |
| FU-66 | `chunkReload.test.js` | Stale chunks: a failure 10 s or more after the last reload reloads again | — (deploy updates, no SRS requirement) | — | unit |
| FU-67 | `chunkReload.test.js` | Stale chunks: a second preloadError on the same page never reloads twice | — (deploy updates, no SRS requirement) | — | unit |
| FU-68 | `chunkReload.test.js` | Stale chunks: blocked sessionStorage still reloads once | — (deploy updates, no SRS requirement) | — | unit |
| FU-69 | `chunkReload.test.js` | Stale chunks: installChunkReload listens for vite:preloadError on window and uses sessionStorage | — (deploy updates, no SRS requirement) | — | unit |
| FU-70 | `chunkReload.test.js` | Stale chunks: an import aborted because the visitor is leaving the page does not reload | — (deploy updates, no SRS requirement) | — | unit |
| FU-71 | `chunkReload.test.js` | Stale chunks: a page restored from the back/forward cache handles a missing chunk again | — (deploy updates, no SRS requirement) | — | unit |
| FU-72 | `PageErrorBoundary.test.jsx` | Stale chunks: a page that could not be loaded shows the error and a Reload button | — (deploy updates, no SRS requirement) | — | unit |
| FU-73 | `PageErrorBoundary.test.jsx` | Stale chunks: going to another page clears the error | — (deploy updates, no SRS requirement) | — | unit |
| FU-74 | `PageErrorBoundary.test.jsx` | Stale chunks: while the reload for a new build is pending, the loading line shows instead of the error | — (deploy updates, no SRS requirement) | — | unit |
| FU-75 | `chunkReload.test.js` | Stale chunks: blocked storage and a reload stamp from 2 s ago in history.state: no reload, the error goes through | — (deploy updates, no SRS requirement) | — | unit |
| FU-76 | `chunkReload.test.js` | Stale chunks: blocked storage and an empty history.state: reloads once and writes the stamp to history.state | — (deploy updates, no SRS requirement) | — | unit |
| FU-77 | `chunkReload.test.js` | Stale chunks: with neither storage nor history.state available it does not reload at all | — (deploy updates, no SRS requirement) | — | unit |
| FU-78 | `chunkReload.test.js` | Stale chunks: the newer of the two stamps counts | — (deploy updates, no SRS requirement) | — | unit |
| FU-79 | `utilsCoverage.test.js` | Utils: aspectOf gives width / height, or null when a side is unknown | FR13.11 | — | unit |
| FU-80 | `utilsCoverage.test.js` | Utils: orientationOf calls near-square videos square | FR13.11 | — | unit |
| FU-81 | `utilsCoverage.test.js` | Utils: inspectVideoFile reads the duration and size and grabs a poster frame at most 640 px wide | FR13.11 | — | unit |
| FU-82 | `utilsCoverage.test.js` | Utils: inspectVideoFile keeps the size when the poster cannot be drawn, and gives zeros for an unreadable file | FR13.11 | — | unit |
| FU-83 | `utilsCoverage.test.js` | Utils: GitHub accepts a username or a profile link, and refuses anything else | — (frontend helpers, no SRS requirement) | — | unit |
| FU-84 | `utilsCoverage.test.js` | Utils: LinkedIn accepts a profile slug or link, and always stores the full https link | — (frontend helpers, no SRS requirement) | — | unit |
| FU-85 | `utilsCoverage.test.js` | Utils: safeRouteId keeps plain ids and drops anything that could change a URL | — (frontend helpers, no SRS requirement) | — | unit |
| FU-86 | `utilsCoverage.test.js` | Utils: formatTime shows mm:ss and treats bad input as zero | — (frontend helpers, no SRS requirement) | — | unit |
| FU-87 | `utilsCoverage.test.js` | Utils: formatBytes picks B, KB or MB | — (frontend helpers, no SRS requirement) | — | unit |
| FU-88 | `utilsCoverage.test.js` | Utils: initialsOf and greeting | — (frontend helpers, no SRS requirement) | — | unit |
| FU-89 | `utilsCoverage.test.js` | Utils: two players asking for one video share one download and both hear the progress | — (frontend helpers, no SRS requirement) | — | unit |
| FU-90 | `utilsCoverage.test.js` | Utils: a removed progress listener hears nothing more | — (frontend helpers, no SRS requirement) | — | unit |
| FU-91 | `utilsCoverage.test.js` | Utils: a failed download is forgotten, so the next attempt downloads again | — (frontend helpers, no SRS requirement) | — | unit |
| FU-92 | `utilsCoverage.test.js` | Utils: an expired video is kept for a player still using it, then released | — (frontend helpers, no SRS requirement) | — | unit |
| FU-93 | `utilsCoverage.test.js` | Utils: past the 250 MB budget the oldest videos are dropped first | — (frontend helpers, no SRS requirement) | — | unit |
| FU-94 | `utilsCoverage.test.js` | Utils: prefetchVideo downloads in the background and ignores failures | — (frontend helpers, no SRS requirement) | — | unit |

## 5. Frontend integration tests — `frontend/test/integration/`

Rendered with the real router, providers and API client; only the network is mocked, with MSW.

| ID | Test file | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| FI-01 | `Login.test.jsx` | signs the contributor in and puts the session in the auth provider | FR13.1 | — | integration |
| FI-02 | `Login.test.jsx` | shows the server message when the credentials are refused | FR13.1 | — | integration |
| FI-03 | `Login.test.jsx` | puts field errors from a 422 next to their input | FR13.1 | — | integration |
| FI-04 | `Login.test.jsx` | never reaches the network when the form itself is invalid | FR13.1 | — | integration |
| FI-05 | `Contact.test.jsx` | C2: a signed-in contributor who opens the landing page directly gets the signed-in form | FR13.13, UI 3.1.1.3 | C2 | integration |
| FI-06 | `Contact.test.jsx` | C2: a signed-in contributor sends a general message and sees the confirmation | FR13.13 | C2 | integration |
| FI-07 | `Contact.test.jsx` | C2: a signed-out deletion request goes to the verify page with the message id | FR13.13 | C2 | integration |
| FI-08 | `Contact.test.jsx` | C2: a signed-in deletion request needs no code and shows the confirmation | FR13.13 | C2 | integration |
| FI-09 | `Contact.test.jsx` | C2: field errors from a 422 appear next to their input | FR13.13 | C2 | integration |
| FI-10 | `Contact.test.jsx` | C2: a %s from the server shows its message and keeps the form | FR13.13 | C2 | integration |
| FI-11 | `ContactVerify.test.jsx` | D4: the right code confirms the request | FR13.13 | S4 | integration |
| FI-12 | `ContactVerify.test.jsx` | D4: a wrong or expired code shows the server message | FR13.13 | S4 | integration |
| FI-13 | `ContactVerify.test.jsx` | D4: a code that is not six digits never reaches the network | FR13.13 | S4 | integration |
| FI-14 | `ContactVerify.test.jsx` | D4: the resend button waits a minute, then asks for a new code and waits again | FR13.13 | S4 | integration |
| FI-15 | `ContactVerify.test.jsx` | D4: a 429 on resend shows the server message | FR13.13 | S4 | integration |
| FI-16 | `ContactVerify.test.jsx` | D4: a missing or malformed id (%s) shows an invalid-link message | FR13.13 | S4 | integration |
| FI-17 | `AdminMessages.test.jsx` | C3: lists messages with their verification badge, open messages first by default | FR13.13 | C3 | integration |
| FI-18 | `AdminMessages.test.jsx` | C3: the filters reach the API | FR13.13 | C3 | integration |
| FI-19 | `AdminMessages.test.jsx` | C3: find contributor → delete recordings with the confirmed count → mark done | FR13.13 | C3 | integration |
| FI-20 | `AdminMessages.test.jsx` | C3: an unverified request with no current account is flagged for a manual check | FR13.13 | C3 | integration |
| FI-21 | `AdminMessages.test.jsx` | C3: a partial failure is shown and the remaining count is kept | FR13.13 | C3 | integration |
| FI-22 | `ConsentReload.test.jsx` | B4: keeps the visitor on the consent page, and accepting uses the saved token then clears it | FR13.1, OR-19 | B4 | integration |
| FI-23 | `ConsentReload.test.jsx` | B4: declining also clears the saved token | FR13.1, OR-19 | B4 | integration |
| FI-24 | `ConsentReload.test.jsx` | B4: with no saved token the visitor is sent back to verify their email | FR13.1, OR-19 | B4 | integration |
| FI-25 | `AccountSecurity.test.jsx` | S6: sends the three fields and confirms that other devices were signed out | SE-2, SE-9 | S6 | integration |
| FI-26 | `AccountSecurity.test.jsx` | a wrong current password is shown next to that field | SE-2, SE-3 | — | integration |
| FI-27 | `AccountSecurity.test.jsx` | a server field error (same password) is shown next to the new password | SE-2, SE-3 | — | integration |
| FI-28 | `AccountSecurity.test.jsx` | mismatched or short passwords never reach the network | SE-2, SE-3 | — | integration |
| FI-29 | `AccountSecurity.test.jsx` | S6: calls logout and leaves the profile | SE-2, SE-9 | S6 | integration |
| FI-30 | `AccountSecurity.test.jsx` | S6: explains that it ends every session, this one included | SE-2, SE-9 | S6 | integration |
| FI-31 | `ConsentReload.test.jsx` | B3: an expired sign-up step clears the saved token and offers a fresh sign-up | FR13.1, SE-9 | B3 | integration |
| FI-32 | `ConsentReload.test.jsx` | B3: declining with an expired step also clears the saved token | FR13.1, SE-9 | B3 | integration |
| FI-33 | `AdminActivity.test.jsx` | S7: lists entries with the admin name, a readable action, the target and the details | FR13.12, SE-1 | S7 | integration |
| FI-34 | `AdminActivity.test.jsx` | S7: the admin filter offers the admins and System, and sends the chosen one | FR13.12, SE-1 | S7 | integration |
| FI-35 | `AdminActivity.test.jsx` | S7: the action filter sends the chosen action and goes back to page 1 | FR13.12, SE-1 | S7 | integration |
| FI-36 | `AdminActivity.test.jsx` | S7: Previous and Next page through the log | FR13.12, SE-1 | S7 | integration |
| FI-37 | `AdminActivity.test.jsx` | S7: an empty log and a failed request each show a message | FR13.12, SE-1 | S7 | integration |
| FI-38 | `AdminSubmissions.test.jsx` | B5: lists submissions with trim, mirror and the contributor, and Load more follows the cursor | FR13.6, FR13.8 | B5 | integration |
| FI-39 | `AdminSubmissions.test.jsx` | B5: the category, video and date filters reach the API, and a new category clears the video | FR13.6, FR13.8 | B5 | integration |
| FI-40 | `AdminSubmissions.test.jsx` | B5: the contributor search filters by the chosen contributor | FR13.6, FR13.8 | B5 | integration |
| FI-41 | `AdminSubmissions.test.jsx` | B5: Download CSV and Download JSON link to the export with the current filters | FR13.6, FR13.8 | B5 | integration |
| FI-42 | `AdminSubmissions.test.jsx` | B5: an end date before the start date is flagged and nothing is requested | FR13.6, FR13.8 | B5 | integration |
| FI-43 | `AdminDashboard.test.jsx` | B7: renders the key numbers, chart, categories, top lists and recent list from /admin/stats only | FR13.12 | B7 | integration |
| FI-44 | `AdminDashboard.test.jsx` | B7: the days, category and contributor filters reach the stats query | FR13.12 | B7 | integration |
| FI-45 | `AdminDashboard.test.jsx` | B7: an empty range shows the empty notes, and a failed request shows an error | FR13.12 | B7 | integration |
| FI-46 | `apiClient.test.js` | API client: %s sends the right request | — (API client, no SRS requirement) | — | integration |
| FI-47 | `apiClient.test.js` | API client: every request carries the browser's device ID, the same one each time | — (API client, no SRS requirement) | — | integration |
| FI-48 | `apiClient.test.js` | API client: no device ID is sent when browser storage is blocked | — (API client, no SRS requirement) | — | integration |
| FI-49 | `apiClient.test.js` | API client: the less common route builders give the API paths | — (API client, no SRS requirement) | — | integration |
| FI-50 | `apiClient.test.js` | API client: an invalid sign-up never reaches the network and names the fields | SE-10 | — | integration |
| FI-51 | `apiClient.test.js` | API client: an invalid admin query never reaches the network | SE-10 | — | integration |
| FI-52 | `apiClient.test.js` | API client: dates become timestamps and the API's file paths stay on the site | — (API client, no SRS requirement) | — | integration |
| FI-53 | `apiClient.test.js` | API client: an error envelope becomes an Error with the message, the fields and the status | — (API client, no SRS requirement) | — | integration |
| FI-54 | `apiClient.test.js` | API client: a failure with no JSON body still gives the status | — (API client, no SRS requirement) | — | integration |
| FI-55 | `apiClient.test.js` | API client: 204 No Content resolves to undefined | — (API client, no SRS requirement) | — | integration |
| FI-56 | `apiClient.test.js` | API client: a list endpoint with no data gives an empty list | — (API client, no SRS requirement) | — | integration |
| FI-57 | `apiClient.test.js` | API client: a users page normalises its items and keeps the paging fields | — (API client, no SRS requirement) | — | integration |
| FI-58 | `apiClient.test.js` | API client: statistics are fetched once, then served from the 30-minute browser cache | UI 3.1.1.3 | — | integration |
| FI-59 | `apiClient.test.js` | API client: two statistics requests at once share one network call | UI 3.1.1.3 | — | integration |
| FI-60 | `apiClient.test.js` | API client: an expired or malformed cache entry is dropped and fetched again | — (API client, no SRS requirement) | — | integration |
| FI-61 | `apiClient.test.js` | API client: statistics in the wrong shape are refused and not cached | UI 3.1.1.3 | — | integration |
| FI-62 | `apiClient.test.js` | API client: statistics still arrive when browser storage is full | UI 3.1.1.3 | — | integration |
| FI-63 | `apiClient.test.js` | API client: a reference video is sent as a form, with the poster image decoded in memory | FR13.11 | — | integration |
| FI-64 | `apiClient.test.js` | API client: an external video is sent by URL, with no file and defaults for the size | FR13.11 | — | integration |
| FI-65 | `apiClient.test.js` | API client: a poster that is neither a Blob nor a data URL is left out | FR13.11 | — | integration |
| FI-66 | `apiClient.test.js` | API client: the demo video is sent as a form | FR13.11 | — | integration |
| FI-67 | `apiClient.test.js` | API client: a recording is submitted with its trim and mirror values | FR13.8 | — | integration |
| FI-68 | `apiClient.test.js` | API client: the background upload sends the form with credentials and the device ID, reports progress and returns the submission | FR13.8 | — | integration |
| FI-69 | `apiClient.test.js` | API client: a refused background upload rejects with the API's message, fields and status | FR13.8 | — | integration |
| FI-70 | `apiClient.test.js` | API client: a background upload that fails without JSON still gives the status | FR13.8 | — | integration |
| FI-71 | `apiClient.test.js` | API client: a lost connection during a background upload gives a clear message | FR13.8 | — | integration |
| FI-72 | `apiClient.test.js` | API client: a background upload can be cancelled before or during the upload | FR13.8 | — | integration |
| FI-73 | `apiClient.test.js` | API client: a video from the API is downloaded with progress, credentials and the device ID | — (API client, no SRS requirement) | — | integration |
| FI-74 | `apiClient.test.js` | API client: a video larger than the limit is refused before or while it downloads | — (API client, no SRS requirement) | — | integration |
| FI-75 | `apiClient.test.js` | API client: a failed download names the status | — (API client, no SRS requirement) | — | integration |
| FI-76 | `apiClient.test.js` | API client: notifications are per user, newest first, and can be marked read one by one or all at once | — (API client, no SRS requirement) | — | integration |
| FI-77 | `apiClient.test.js` | API client: unreadable stored notifications read as none | — (API client, no SRS requirement) | — | integration |

## 6. End-to-end tests — `e2e/tests/`

Playwright, in Chromium, Firefox and WebKit, against the production frontend build and a real
API with an in-memory database.

| ID | Spec | Test name | Requirement | Checklist | Level |
| --- | --- | --- | --- | --- | --- |
| E-01 | `landing.spec.js` | loads and shows the public sections without page errors | UI 3.1.1.3 | — | E2E |
| E-02 | `landing.spec.js` | the API the site talks to is healthy through the preview proxy | QA-3 | C1 (fixture) | E2E |
| E-03 | `signup.spec.js` | sign-up: form, emailed code, consent, then the library | FR13.1, OR-19 | — | E2E |
| E-04 | `cross-host-cookie.spec.js` | C4: login cookie set by api.localtest.me works on commons.localtest.me | FR13.1, SE-2 | C4 | E2E |
| E-05 | `contact.spec.js` | C2: a signed-in contributor sends a contact message from the landing page | FR13.13 | C2 | E2E |
| E-06 | `contact.spec.js` | D4: a signed-out deletion request is confirmed with the emailed code | FR13.13 | S4 | E2E |
| E-07 | `admin-deletion.spec.js` | C3: a deletion request ends with 0 recordings left for that contributor | FR13.13 | C3 | E2E |
| E-08 | `account-security.spec.js` | S2: five wrong passwords lock the account, and the right one is refused until the lock passes | SE-4 | S2 | E2E |
| E-09 | `account-security.spec.js` | S6: resetting the password on another device logs out the old session | SE-2, SE-9 | S6 | E2E |
| E-10 | `account-security.spec.js` | B4: reloading the consent page keeps the visitor on it, and accepting still works | FR13.1, OR-19 | B4 | E2E |
| E-11 | `admin-activity.spec.js` | S7: two admins each make a change, and Activity shows the right name for each | FR13.12, SE-1 | S7 | E2E |
| E-12 | `admin-export.spec.js` | B5: an admin downloads the CSV export, and its rows match the submissions made | FR13.6, FR13.8 | B5 | E2E |
| E-13 | `csp.spec.js` | S8: every page and file is served with the CSP and the other security headers | — (browser hardening, no SRS requirement) | S8 | E2E |
| E-14 | `csp.spec.js` | S8: an injected inline script is blocked, and the violation is reported | — (browser hardening, no SRS requirement) | S8 | E2E |
| E-15 | `csp.spec.js` | S8: the theme is still set before the app runs (public/theme-init.js under the CSP) | — (browser hardening, no SRS requirement) | S8 | E2E |
| E-16 | `csp.spec.js` | S8: the sign-in background photo comes from the site itself | — (browser hardening, no SRS requirement) | S8 | E2E |
| E-17 | `admin-video-tool.spec.js` | S8: the admin video tool processes a clip with ffmpeg from /ffmpeg, under the CSP | FR13.11 | S8 | E2E |
| E-18 | `accessibility.spec.js` | QA-20: the landing page, the library and the watch page have no serious problems | QA-20 | — | E2E |
| E-19 | `accessibility.spec.js` | QA-20: the recording editor has no serious problems | QA-20 | — | E2E |
| E-20 | `accessibility.spec.js` | QA-20: every admin tab has no serious problems | QA-20 | — | E2E |
| E-21 | `stale-chunks.spec.js` | Stale chunks: a page chunk that is gone after a deploy reloads the page once, and the page then opens | — (deploy updates, no SRS requirement) | — | E2E |
| E-22 | `stale-chunks.spec.js` | Stale chunks: a chunk that stays missing shows the error after one reload instead of reloading forever | — (deploy updates, no SRS requirement) | — | E2E |
| E-23 | `stale-chunks.spec.js` | Stale chunks: with sessionStorage blocked, a chunk that stays missing reloads once, then shows the error | — (deploy updates, no SRS requirement) | — | E2E |
| E-24 | `stale-chunks.spec.js` | Stale chunks: with sessionStorage blocked, a chunk missing once reloads once, then the page opens | — (deploy updates, no SRS requirement) | — | E2E |
| E-25 | `record-submit.spec.js` | FR13.8: record, trim, mirror and submit; the cooldown shows the time left, then the video can be recorded again | FR13.6, FR13.8, FR13.9 | — | E2E |
| E-26 | `account-controls.spec.js` | FR13.12: a suspended contributor can neither submit nor log in, and Reactivate restores access | FR13.12, SE-2 | — | E2E |
| E-27 | `account-controls.spec.js` | FR13.12: a restricted device is refused, and removing the restriction restores access | FR13.12 | — | E2E |
| E-28 | `upload-limit.spec.js` | FR13.8: a recording of about 90 MB is accepted and one over 100 MB is refused with a reason | FR13.8, SE-10 | — | E2E |
| E-29 | `smoke.spec.js` | Smoke: the landing page loads with the security headers | UI 3.1.1.3 | — | E2E |
| E-30 | `smoke.spec.js` | Smoke: a contributor logs in and sees the library | FR13.1 | — | E2E |
| E-31 | `smoke.spec.js` | Smoke: the profile shows the account, and logging out ends the session | FR13.1, SE-2 | — | E2E |

## 7. Gaps to close in later phases

Phase 0 built the levels; the checklist items themselves are still open. Each phase adds at
least one regression test named with its ID (for example `C5: removes the temp file after a
Drive upload`) and a row here.

| Checklist | Planned coverage | Phase |
| --- | --- | --- |
| C1, C4, S3, S5 | **Covered in Phase 1** (U-38–U-61, I-46–I-49, S-06–S-10, FU-21–FU-23, E-04). The real-server checks are still pending: see `docs/phase-reports/PHASE-1.md`. | 1 |
| C5, B1, B6, B8 | **Covered in Phase 2** (U-62–U-89, I-50–I-56, S-11–S-13). Real-server check pending: a production upload leaves `uploads/tmp` empty. | 2 |
| S1 | **Covered in Phase 3** (U-90, U-91, FU-24; the whole suite re-run on the patched versions). The CI audit job is now required. | 3 |
| C2, S4 | **Covered in Phase 4** (U-92–U-123, I-39 adjusted, I-57–I-72, S-14–S-17, the two new access-matrix routes, FU-25–FU-28, FI-05–FI-16, E-05, E-06). | 4 |
| C3 | **Covered in Phase 5** (U-124–U-140, I-73–I-85, S-18, S-19, the four new access-matrix routes, FU-29–FU-34, FI-17–FI-21, E-07). | 5 |
| S2, S6, S9, B2, B3, B4 | **Covered in Phase 6** (U-141–U-161, I-86–I-110, S-20–S-25, the new access-matrix route, FU-35–FU-42, FI-22–FI-32, E-08–E-10). | 6 |
| S7 | **Covered in Phase 7** (U-162–U-182, U-133 changed for item 5, I-111–I-125, the new access-matrix route, FI-33–FI-37, E-11). | 7 |
| B5, B7 | **Covered in Phase 8** (U-183–U-202, U-180 and U-182 reordered for item 6, I-126–I-149, the two new access-matrix routes, FI-38–FI-45, E-12; after verification U-203–U-206 and I-150–I-159). The dataset script is run for real with ffmpeg on local files (I-156–I-159); Drive downloads are covered by unit tests only. | 8 |
| S8, S10 | **Covered in Phase 9** (U-207–U-209, I-160–I-162, FU-43–FU-63, E-13–E-20). Every E2E test also runs under the CSP and fails on any violation (`e2e/support/test.js`). | 9 |
| all | **Done in Phase 10.** `traceability.test.js` now fails if any FR13.1–FR13.13 or any checklist ID C1–C5, S1–S10, B1–B8 has no test (U-212). Also new: the docs-sync tests (U-210–U-211), the API client and utils tests (FU-79–FU-94, FI-46–FI-77), and E2E for every automatable line of the production checklist, plus the `@smoke` subset (E-25–E-31). | 10 |
| C1 (D1 changed) | **Phase 11: the API on Coolify.** U-213–U-222 and I-163–I-167 (the request timeout, the container warning, the Dockerfile, `.dockerignore`, the Coolify guide, the CI jobs, and after verification `/health/live`: the container's check fails only without the database, and a storage failure no longer stops the API). The access matrix gained `GET /api/v1/health/live` (public). The built image itself is checked in CI by `deploy/scripts/check-docker-image.sh` (job "Docker image": runs as `node`, no tests or `.env` files or dev dependencies, bcrypt works, healthy against a real MongoDB, `requestTimeoutMs` 900000, healthy with storage failing while `/health` answers 503, graceful `docker stop`); it is a CI script, not a row here. Coolify and Traefik themselves are checked on the server: see `docs/phase-reports/PHASE-11.md`. | 11 |

## 8. Running the suites

```sh
cd backend  && npm run test:unit && npm run test:integration && npm run test:security
cd backend  && npm run test:coverage     # c8 + the floors in coverage-thresholds.json
cd frontend && npm run lint && npm test && npm run test:coverage && npm run build
cd e2e      && npm run e2e               # one-off first: npx playwright install
```

See [setup.md](./setup.md) section 8 for the fixtures and environment each level uses, and
`docs/FIX-PLAN.md` section 4.6 for the full gate.

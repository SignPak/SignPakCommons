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

Counts as of **Phase 6** (backend 1.0.12, frontend 1.0.14):

| Level | Where | Files | Cases |
| --- | --- | ---: | ---: |
| Unit (backend) | `backend/tests/unit/` | 29 | 161 |
| Integration (backend) | `backend/tests/integration/` | 15 | 110 |
| Security (backend) | `backend/tests/security/` | 8 | 78 |
| Unit (frontend) | `frontend/test/unit/` | 12 | 42 |
| Integration (frontend) | `frontend/test/integration/` | 6 | 37 |
| End-to-end | `e2e/tests/` | 6 | 30 (10 tests × 3 browsers) |
| **Total** | | **76** | **458** |

The backend security count is per-route: the access matrix produces one case per route (54
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
| U-133 | `removeAllForUser.test.js` | C3: accountDeleted is logged only when the account deletion will go ahead | FR13.13 | C3 | unit |
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

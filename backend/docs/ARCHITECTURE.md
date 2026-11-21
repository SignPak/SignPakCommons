# SignPak Commons Backend Architecture

## Runtime and startup

The backend is an Express 4 application using Node.js 22+ and MongoDB through
Mongoose. Environment validation lives in `src/config/env.js`. The HTTP app is
composed in `src/app.js`; it exports an Express app without binding its own port so
that tests can import it.

In production the API is one long-running Node process on the team's own Linux server,
kept alive by PM2 (one process, fork mode) behind Nginx with HTTPS at `api.commons.signpak.tech`;
the website is on Vercel at `commons.signpak.tech`. The deployment files and the server guide
are in `deploy/`.

`server.js` is the entry point. It logs configuration warnings from
`src/config/startupChecks.js` (for example `TRUST_PROXY` off in production), starts the
HTTP listener on `HOST` (`127.0.0.1` in production, so only Nginx on the same machine can
connect and nobody can bypass it to forge `X-Forwarded-For`; `0.0.0.0` elsewhere), and starts
initialization straight away. On `SIGTERM`/`SIGINT` it shuts down
gracefully (`src/utils/gracefulShutdown.js`): it stops accepting connections, lets in-flight
requests finish, closes MongoDB, and exits, or exits 1 after 10 seconds. PM2 waits 15 seconds
before forcing it.

Initialization is idempotent and shared between startup and requests:
`src/services/initialization.js` connects MongoDB, initializes the selected storage drivers,
and ensures the configured admin exists. The app-level initialization middleware awaits it
before processing a request, and returns `503 SERVICE_UNAVAILABLE` if it fails. In production
that body is generic; the underlying error is only included as `detail` outside production,
because it can contain hosts or credentials (checklist S5). `GET /api/v1/health` is let
through even when initialization fails, so it can report `database` and `storage` status
(booleans only) instead of the generic 503. For Google Drive, "storage initialized" includes
reading the root folder through the API, so `storage: true` means the OAuth token worked at
startup; a token revoked afterwards shows up on the next upload (logged as `invalid_grant`).

## Request flow

```text
HTTP request
  -> app initialization
  -> request ID and structured logging
  -> Helmet, CORS, compression, JSON parsing, cookies
  -> API-wide rate limit, origin check, device/IP restriction check
  -> route authentication, role check, validation, upload parsing
  -> controller
  -> service
  -> repository
  -> Mongoose model
  -> MongoDB
```

The dependency direction is one-way: controllers do not query models, services do
not read `req` or write `res`, and repositories encapsulate persistence without
owning business policy.

## Responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Runtime | `server.js` | Export the serverless handler and start the standalone listener. |
| Application | `src/app.js` | Compose initialization, middleware, API/docs routes, and error handling. |
| Routes | `src/routes/` | Map paths to controllers and compose route-level guards and validation. |
| Middleware | `src/middlewares/` | Authentication, roles, input validation, uploads, rate limiting, origin checks, access restrictions, and error mapping. |
| Controllers | `src/controllers/` | Translate HTTP input to service calls and standard response helpers. |
| Services | `src/services/` | Enforce domain rules and coordinate persistence, storage, and external providers. |
| Repositories | `src/repositories/` | Encapsulate MongoDB queries and persistence operations. |
| Models | `src/models/` | Define Mongoose schemas, indexes, and JSON serialization. |
| Storage | `src/services/storage/` | Provide local and Google Drive implementations behind storage operations. |
| Configuration | `src/config/` | Validate environment variables, manage DB connection, and define constants. |
| OpenAPI | `src/docs/openapi.js` | Describe API operations and schemas used by Swagger UI and raw JSON. |
| Email | `src/services/email/` | Driver seam for authentication codes: Brevo in production, in-memory capture in tests. |
| Tests | `tests/unit/`, `tests/integration/`, `tests/security/`, `tests/support/` | Levels run separately; shared fixtures, the fake Drive driver and the router inventory live in `support/`. |
| Documentation | `docs/` | Human-readable API, setup, architecture, and test references. |

## API boundary and middleware

Application routes are mounted under `/api/v1`. JSON success responses use
`{ "data": value }`; known and unknown failures are normalized to
`{ "error": { "code", "message", "fields?" } }`. `204` responses have no body.
Every request gets an `X-Request-Id` which is included in structured request logs.

The app applies security headers with Helmet, explicit credentialed CORS, response
compression, JSON body parsing, cookie parsing, and request logging. A global
limiter applies to `/api/v1`; auth, contact, and upload endpoints have additional
limits. State-changing browser requests carrying an `Origin` must use a configured
`CLIENT_ORIGIN`. Requests are also checked against hashed device/IP restrictions;
admin routes are exempt from this restriction middleware to allow recovery. Only an
admin creates restrictions (FR13.12); nothing in the contact flow does (S4).

Authentication uses the HTTP-only `signpak_token` cookie. Authenticated requests
reload the account from MongoDB, so role changes, suspensions, deletion, and
session-version changes take effect promptly. See [API.md](./API.md) for route
access and request behavior.

Account security (Phase 6):

- **Session version.** Each token carries the account's `authVersion`; `authenticate`
  rejects a token whose version is not the current one. Logout, a password reset and a
  password change bump it, so they end every session of the account (S6). A password
  change then sets a fresh cookie for the device that made it.
- **Lockout (S2, SE-4).** `authService.login` counts wrong passwords with an atomic
  increment (`userRepo.recordFailedLogin`). The fifth locks the account for
  `AUTH_LOCKOUT_MINUTES`; bcrypt always runs, against a dummy hash for unknown emails.
- **Unfinished sign-ups (S9, B3).** A sign-up sets `signupExpiresAt` 24 h ahead; a TTL
  index limited to `{ emailVerified: false, role: 'user' }` deletes it when that passes,
  and finishing the sign-up clears it. Signing up again with the same unfinished email
  updates the details and restarts the clock. The verify step checks the password with
  the code, so a re-signup by someone else can never hand the owner a password they
  didn't choose. Startup gives older pending accounts an expiry
  (`userRepo.backfillSignupExpiry`).

## Persistence and storage

MongoDB stores users, categories, reference videos, submissions, cooldown claims,
contact messages and quotas, and access restrictions. File bytes are managed
through storage drivers; MongoDB records the storage driver and opaque key along
with media metadata.

The `STORAGE_DRIVER` controls readable reference videos, posters, and the demo
video. `ARCHIVE_STORAGE_DRIVER` independently controls contributor recording
archives. Both default to local storage. A Google Drive archive may use dedicated
archive OAuth credentials or service-account JSON, and can fall back to shared
Google credentials and a shared folder when archive-specific settings are absent.

Submission recordings are append-only. The archive folder is based on contributor
and per-video sequence, category slug, and video slug. MongoDB keeps the archive
reference; the API never streams or mutates the archived file. Contributor
responses omit archive paths, while admins can see archive metadata. Account
deletion removes the account and its cooldown claims but retains its submissions
and archived recording objects. The contact form accepts a separate
recording/data deletion request before or after account deletion, at any time
(FR13.13). Deleting a base video does not remove submissions.

Deletion requests are verified before the team acts on them (D4):

1. A signed-in contributor's request is saved with `verified: true`.
2. A signed-out request is saved with `verified: false`; `contactService` answers at
   once and then, in the background, emails a six-digit code to the address if an
   account uses it (`src/utils/otp.js`, the same HMAC, expiry and attempt rules as
   sign-up). The answer is identical whether or not an account exists.
3. `POST /contact/:id/verify` with the right code sets `verified: true`;
   `POST /contact/:id/resend` sends a new code at most once a minute and at most 5 codes
   per request. The send time and count are claimed in one atomic update
   (`messageRepo.claimResend`), so simultaneous resends can't both pass. An address gets
   at most `CONTACT_CODE_EMAILS_PER_DAY` code emails a day across all requests (a
   `ContactSenderQuota` row keyed by an HMAC of the address); past that the code is
   silently not sent.
4. A request for an email with no account stays unverified for the team to check by
   hand. Each message also has `status`, `handledAt` and `handledBy` for that work.

Signed-out requests are limited per IP and per device (`CONTACT_SENDER_DAILY_LIMIT`,
keyed by an HMAC so neither is stored in the clear) and are exempt from the site-wide
cap on general messages, so that cap cannot be used to block deletion requests.

An admin acts on a deletion request from **Admin → Messages** (C3):

1. **Find contributor** (`deletionLookupService`) matches the request's email to the
   current account and, through `hashEmail()` (`src/utils/emailHash.js`, an HMAC with
   `EMAIL_HASH_SECRET`), to any `DeletedAccount`. One of those is written whenever an
   account is deleted, by an admin or by its owner, because account deletion keeps the
   recordings.
2. **Delete recordings** (`submissionService.removeAllForUser`) removes each recording
   file through `storageService.remove`, then its Submission document, then the
   cooldowns. A failed file keeps its document, so a retry finishes the job.
3. A `DeletionLog` row records the user id, the email hash (never the email), the counts,
   the request message and the admin. Both deletion collections are append-only.
4. **Mark done** sets the message's `status`, `handledAt` and `handledBy`.

`DELETE /admin/users/:id?withRecordings=true` runs step 2 before deleting the account,
and keeps the account if any file can't be deleted.

Uploads first land in a temporary directory (`UPLOAD_DIR/tmp`). Multer limits file size and
count; services then inspect file signatures before handing valid assets to the selected
storage driver. `storageService.save()` and `archive()` delete the temp file afterwards,
whether the save succeeded or not. The local driver moves the file, but the Google Drive
driver only reads it, so without this every Drive upload would stay on disk (checklist C5).
At startup the local driver also deletes temp files more than an hour old, left by a crash
mid-request.

When a multi-step operation fails part-way (stored the file, then the database write failed),
each clean-up step runs on its own through `src/utils/cleanup.js`: a failed clean-up is logged
and the next step still runs, and the caller gets the original error, not the clean-up's
(checklist B1). For a submission this means the cooldown is always released. When the demo
video is replaced, the old file is removed only after the database points at the new one, and a
failure there is logged rather than rolled back.

The Google Drive driver shares one folder lookup between concurrent uploads to the same new
folder, so it never creates duplicate folders (B8). If Google answers `invalid_grant` (the
OAuth refresh token expired or was revoked, usually because the consent screen was left in
"Testing"), the log says so in plain words, with the variable to replace (D3).

## Security and operational controls

- JWTs are placed in HTTP-only cookies; password reset invalidates existing
  sessions.
- Password login avoids revealing whether an email exists.
- Verification and password-reset codes are stored as keyed hashes, expire, and
  have bounded attempts and resend intervals.
- Zod validates bodies, query parameters, and route IDs.
- File signatures, rather than supplied MIME types, determine accepted video and
  image formats. MP4-family files are accepted by brand (B6): audio (M4A), image (HEIC,
  AVIF) and 3GP/3G2 major brands are refused; listed video brands are accepted; an unknown
  major brand only passes if it declares a listed video brand as compatible.
- Access restrictions store hashed identifiers and expose only short hints.
- Contact requires a signed-in account email match and enforces per-account and
  global daily quotas; abusive attempts may create a temporary device/IP block.
- `TRUST_PROXY` makes Express trust exactly one proxy hop (Nginx). With it, `req.ip`
  is the visitor's address from `X-Forwarded-For`; rate limits, IP restrictions and the
  `clientIp` field on every request log line all use it. Without it, a client-supplied
  `X-Forwarded-For` is ignored. Production must set it; the server warns at startup if not.

## Testing and API documentation

Tests are organised by level, and each level can run on its own:

| Level | Location | What it exercises |
| --- | --- | --- |
| Unit | `tests/unit/` | single functions, services and storage drivers with their dependencies faked |
| Integration | `tests/integration/` | HTTP requests against the real app, with MongoDB in memory and local storage in a temporary folder |
| Security | `tests/security/` | the access matrix for every registered route, and the guard on the test-only hook |

`npm test` runs all three serially through Node's test runner; `npm run test:unit`,
`test:integration` and `test:security` run one level. `npm run test:coverage` adds c8 and
then enforces the per-directory floors in `coverage-thresholds.json` through
`scripts/check-coverage.js`; floors may only be raised.

Shared fixtures live in `tests/support/`: `helpers.js` (test environment, cookie-aware HTTP
client, sample media), `apiContext.js` (the app plus a fresh database and seeded accounts),
`fakeDriveDriver.js` (an in-memory driver with the Google Drive interface and failure
switches) and `routeInventory.js` (walks the Express router so the access matrix can prove
every route has an access decision).

Integration suites use MongoDB Memory Server by default. Set `MONGODB_URI_TEST` to use an
existing disposable database instead—the tests drop it.

End-to-end tests are Playwright specs in `e2e/` at the repository root, run against the
production frontend build and an API started by `scripts/e2e-server.js` (in-memory MongoDB,
local storage, captured email, test hooks enabled). See [TEST-CASES.md](./TEST-CASES.md) for
the full inventory and traceability table.

Raw OpenAPI JSON is available at `/api/v1/docs.json` in every environment.
Interactive Swagger UI is only mounted outside production. Update
`src/docs/openapi.js` alongside routes, validators, and this API reference when an
endpoint contract changes.

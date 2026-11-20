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
(booleans only) instead of the generic 503.

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
admin routes are exempt from this restriction middleware to allow recovery.

Authentication uses the HTTP-only `signpak_token` cookie. Authenticated requests
reload the account from MongoDB, so role changes, suspensions, deletion, and
session-version changes take effect promptly. See [API.md](./API.md) for route
access and request behavior.

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
recording/data deletion request before or after account deletion, at any time;
requests made after account deletion may require the team to verify and manually
match the former contributor. Deleting a base video does not remove submissions.

Uploads first land in a temporary directory. Multer limits file size and count;
services then inspect file signatures before moving valid assets into the selected
storage driver. Failure paths remove temporary files and clean up files already
stored during a failed multi-step operation.

## Security and operational controls

- JWTs are placed in HTTP-only cookies; password reset invalidates existing
  sessions.
- Password login avoids revealing whether an email exists.
- Verification and password-reset codes are stored as keyed hashes, expire, and
  have bounded attempts and resend intervals.
- Zod validates bodies, query parameters, and route IDs.
- File signatures, rather than supplied MIME types, determine accepted video and
  image formats.
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

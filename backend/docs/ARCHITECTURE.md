# SignPak Commons Backend Architecture

## Runtime and startup

The backend is an Express 4 application using Node.js 22+ and MongoDB through
Mongoose. Environment validation lives in `src/config/env.js`. The HTTP app is
composed in `src/app.js`; it exports an Express app without binding its own port so
that tests and serverless hosts can import it.

`server.js` is the deployment entry point. It starts the standalone HTTP listener
and exports a request handler for Vercel. Background initialization is idempotent
and shared between startup and requests: `src/services/initialization.js`
connects MongoDB, initializes the selected storage drivers, and ensures the
configured admin exists. The app-level initialization middleware awaits this
setup before processing a request and returns a `503 SERVICE_UNAVAILABLE` response
if initialization fails.

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
| Tests | `tests/*.test.js` | Separate HTTP API suites and focused utility, storage, and service tests. |
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
deletion removes that account's archive objects and related submissions; deleting
a base video does not remove submissions.

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
- `TRUST_PROXY` controls Express proxy awareness and should match the hosting
  topology used for IP-based rate limits and restrictions.

## Testing and API documentation

`npm test` runs Node's test runner serially across all `tests/*.test.js`. Each
HTTP integration suite has its own file and a fresh API test context;
`apiContext.js` stubs email/contact providers and provisions isolated test
fixtures. By default, those suites use MongoDB Memory Server. Set
`MONGODB_URI_TEST` to use an existing disposable database instead—the tests drop
it. Focused unit and filesystem/storage integration tests use isolated temporary
directories. See [TEST-CASES.md](./TEST-CASES.md) for the case inventory.

Raw OpenAPI JSON is available at `/api/v1/docs.json` in every environment.
Interactive Swagger UI is only mounted outside production. Update
`src/docs/openapi.js` alongside routes, validators, and this API reference when an
endpoint contract changes.

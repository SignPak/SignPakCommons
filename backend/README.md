# SignPak Commons: backend

Express 4 + Node.js 22+ + MongoDB (Mongoose). Cookie-based authentication,
local-by-default media storage, optional Google Drive storage, and a
layered service/repository architecture.

## Run it

```bash
cd backend
npm install
cp .env.example .env      # set local MongoDB URI, JWT secret, and admin password
npm run dev               # http://localhost:5000
npm test                  # all API, unit, and storage suites
```

Use Node.js 22+ and a MongoDB instance (local or Atlas). Environment values are
validated while loading the app. The standalone server binds its listener and
initializes MongoDB, selected storage drivers, and the configured admin.
Requests wait for the same shared initialization to finish. `server.js` also
exports a handler for Vercel.

## Architecture

```text
routes -> middlewares -> controllers -> services -> repositories -> models -> MongoDB
```

Dependencies point downward: controllers do not query models, services do not
read `req` or write `res`, and repositories encapsulate persistence without
business rules.

| Folder | Responsibility |
| --- | --- |
| `src/routes/` | Map URLs and methods to controllers and compose route guards. |
| `src/middlewares/` | Auth, roles, Zod validation, uploads, rate limits, origin/access checks, errors. |
| `src/controllers/` | Translate requests to service calls and standard responses. |
| `src/services/` | Business rules and coordination of repositories, storage, and providers. |
| `src/services/storage/` | Local and Google Drive storage implementations. |
| `src/repositories/` | MongoDB queries and persistence operations. |
| `src/models/` | Mongoose schemas, indexes, and JSON serialization. |
| `src/config/` | Validated environment, database connection, and shared constants. |
| `src/docs/openapi.js` | OpenAPI schema for the JSON spec and development Swagger UI. |
| `tests/` | One `.test.js` per API suite and focused unit/storage suites. |

`src/app.js` composes the Express app without binding a port;
`src/services/initialization.js` initializes MongoDB, storage, and the configured
admin idempotently; `server.js` is the standalone and Vercel entry point.

Read the full references: [API](docs/API.md),
[architecture](docs/ARCHITECTURE.md), [setup](docs/SETUP.md), and
[test-case inventory](docs/TEST-CASES.md).

## Responses

```jsonc
// Success
{ "data": { "id": "...", "title": "..." } }

// Failure
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields need attention.", "fields": { "email": "Enter a valid email address." } } }
```

Known errors include `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413),
`VALIDATION_ERROR` (422), `TOO_MANY_REQUESTS` (429), and `INTERNAL_ERROR` (500).
Successful deletes return `204` with no body. Responses include an
`X-Request-Id` for log correlation.

## Endpoint overview

All paths are under `/api/v1`.

| Method + path | Access | Notes |
| --- | --- | --- |
| `GET /health` | Public | Reports database readiness. |
| `/auth/*` | Public | Signup, login, email verification, password reset, logout, and session. |
| `GET/PATCH /users/me` | Authenticated user | Read profile and update supported connections. |
| `GET /categories`; `POST/PATCH/DELETE /categories/:id` | Public read; admin write | Deleting a category unassigns its videos. |
| `GET /videos`, `GET /videos/:id[/file/poster]` | Public or admin | Public visibility is published and categorised only; file streaming supports byte ranges. |
| `POST /videos`; `PATCH/DELETE /videos/:id` | Admin | Manage reference videos and optional posters. |
| `GET /demo-video[/file]`; `POST/DELETE /demo-video` | Public read; admin write | Singleton public walkthrough media. |
| `GET/POST /submissions` | Authenticated user | Contributors list their own; admins list all. New submissions are append-only. |
| `POST /contact` | Signed-in account | Email must match account; account and global daily quotas apply. |
| `/admin/users*`, `/admin/restrictions*`, `/admin/stats`, `/admin/messages` | Admin | Account moderation, access restrictions, statistics, and inbox. |

See [API.md](docs/API.md) for the complete route table, limits, visibility, and
request behavior. The OpenAPI JSON is available at `/api/v1/docs.json` in every
environment. Interactive Swagger UI (`/api/v1/docs`, `/docs`, `/api-docs`) is only
mounted outside production.

## Operational rules

- Authentication uses an HTTP-only `signpak_token` cookie. Email verification is
  required before login; password reset invalidates existing sessions.
- `CLIENT_ORIGIN` controls credentialed CORS and the check for browser
  state-changing requests that carry an `Origin` header.
- The global, auth, contact, and upload rate limits can be disabled with
  `RATE_LIMIT_ENABLED=false`; keep them enabled in production.
- `STORAGE_DRIVER` selects reference and demo media storage.
  `ARCHIVE_STORAGE_DRIVER` independently selects append-only contributor archive
  storage. Both default to local; Google Drive credentials can be shared or
  configured separately for archives.
- Upload defaults are 90 MB for base/demo videos and 80 MB for contributor
  recordings. File contents are verified by signature, not browser MIME type.
- `SUBMISSION_COOLDOWN_MS` defaults to 30 seconds per contributor/video pair.
  Atomic claiming prevents simultaneous duplicate submissions; failed processing
  releases the claim.
- Contact delivery uses Web3Forms. A signed-in account can send from its own
  email; quotas are one per account per UTC day and 25 per UTC day globally by
  default. Abusive attempts can temporarily restrict a device or IP.

## Testing

Run from `backend/`:

```bash
npm test
```

The command runs Node's built-in test runner serially across every
`tests/*.test.js` file. The API suites use MongoDB Memory Server unless
`MONGODB_URI_TEST` is supplied. That configured database is dropped by the tests,
so use only a disposable database. Provider delivery is stubbed. The 56 cases and
their test types are documented in [docs/TEST-CASES.md](docs/TEST-CASES.md).

## Current limitation

The backend stores submission trim and mirror metadata but does not use FFmpeg to
probe or physically edit the uploaded recording.

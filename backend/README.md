# SignPakCommons: backend

Express + Node.js + MongoDB (Mongoose). Cookie-based auth, local file storage (Google Drive ready), layered architecture.

## Run it

```bash
cd backend
npm install
cp .env.example .env      # then fill in JWT_SECRET, ADMIN_PASSWORD and MONGODB_URI
npm run dev               # http://localhost:5000, health check at /api/v1/health
npm test                  # integration tests (see "Testing")
```

Needs Node 20+ and a MongoDB (local install or an Atlas connection string). On start the API validates `.env` and tells you exactly what is missing, then connects, creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and listens.

## How a request flows

routes  ->  middlewares  ->  controllers  ->  services  ->  repositories  ->  models  ->  MongoDB

Dependencies only point down. Controllers never touch models; services never see `req`/`res`.

| Folder | Job |
| --- | --- |
| `src/routes/` | Which URL + method goes where, and which guards it passes through |
| `src/middlewares/` | Auth, roles, validation (`validators/` holds the Zod schemas), uploads, rate limits, origin check, error handler |
| `src/controllers/` | Read the request, call one service, send `{ data }`. No logic |
| `src/services/` | All business rules. `storage/` is the file-storage driver layer |
| `src/repositories/` | The only place that queries the database. No rules |
| `src/models/` | Mongoose schemas, indexes, JSON shape |
| `src/utils/` | Typed errors, logger, tokens, file sniffing, Range streaming |
| `src/config/` | Validated env, DB connection, constants |

`src/app.js` builds the app (no port), `server.js` connects and listens, so tests can import `app` directly.

## Responses

```jsonc
// success: data is the resource, or an array of them
{ "data": { "id": "...", "title": "..." } }

// failure: `fields` maps input names to messages, ready for form errors
{ "error": { "code": "VALIDATION_ERROR", "message": "Some fields need attention.", "fields": { "email": "Enter a valid email address." } } }
```

Codes: `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `VALIDATION_ERROR` 422, `TOO_MANY_REQUESTS` 429, `INTERNAL_ERROR` 500. `DELETE` returns `204` with no body. Every response carries an `X-Request-Id` that matches the log line.

## Endpoints (all under `/api/v1`)

| Method + path | Who | Notes |
| --- | --- | --- |
| `GET /health` | anyone | 503 if the database is down |
| `POST /auth/signup` | anyone | Always creates a contributor. Sets the cookie |
| `POST /auth/login` | anyone | Sets the cookie |
| `POST /auth/logout` | anyone | Clears the cookie |
| `GET /auth/session` | anyone | `{ data: user }`, or `{ data: null }` for visitors |
| `GET /users/me` | logged in | |
| `PATCH /users/me` | logged in | `{ connections: { github, linkedin } }`; a handle or a profile link; `null` disconnects |
| `GET /categories` | anyone | |
| `POST /categories`, `PATCH`/`DELETE /categories/:id` | admin | Deleting unassigns its videos, it does not delete them |
| `GET /videos`, `GET /videos/:id` | anyone | Visitors and contributors: published + categorised only. Admin: everything |
| `GET /videos/:id/poster` | anyone (same visibility) | |
| `GET /videos/:id/file` | logged in | Streams with Range support |
| `POST /videos` | admin | `multipart/form-data`: `video` (required), `poster` (optional), `title`, `categoryId`, `level`, `status`, `durationSec` |
| `PATCH`/`DELETE /videos/:id` | admin | Moving to another category appends to the end of that path |
| `GET /submissions` | logged in | Contributors: their own. Admin: all |
| `POST /submissions` | logged in | `multipart/form-data`: `recording`, `videoId`, `trimStart`, `trimEnd`, `mirrored`, `duration` |
| `GET /submissions/:id/recording` | admin | Contributors can never play a submission back |
| `POST /contact` | anyone | Rate limited: 5 per hour per IP |
| `GET /admin/users`, `/admin/stats?days=14`, `/admin/messages` | admin | |

## Decisions worth knowing

**Auth.** A signed JWT in an `httpOnly` cookie (`signpak_token`), so page scripts cannot read it. The user is reloaded from the database on every request, so role changes and deletions apply immediately. Login answers identically for "wrong password" and "no such email", and does the same amount of hashing work for both.

**CSRF.** `SameSite=Lax` plus an `Origin` check: any `POST/PATCH/DELETE` carrying an `Origin` header outside `CLIENT_ORIGIN` is refused with 403.

**Admin.** Created or promoted from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on every start. Signup ignores any `role` in the body. Changing `ADMIN_PASSWORD` later does not reset an existing admin's password.

**The cooldown rule.** This is a data-collection tool, not a one-shot quiz: a contributor can submit the same video more than once (more varied takes make better training data), but not back to back. `SUBMISSION_COOLDOWN_MS` (default 30s, in `.env`) is the minimum gap between two submissions for the same `(user, video)`. It is enforced atomically, not by a simple read-then-write: `repositories/submissionRepo.js#claimCooldown` does a conditional `findOneAndUpdate` with `upsert: true` against a `SubmissionCooldown` collection that has a unique index on `(user, video)`. If a live cooldown already exists, the upsert's insert path collides with that unique index (`E11000`), which is treated as "still cooling down" — so three simultaneous submissions for the same video still produce exactly one success (verified: `tests/api.test.js`'s concurrent-submit test). A submission that fails after claiming the cooldown (a storage or DB error) releases it, so a failed attempt never costs the contributor their next try. Regardless of timing, no submission can ever be edited or deleted once made, and only an admin can watch one back.

**Uploads.** Multer writes to `uploads/tmp`, the service checks the file's real type from its first bytes (MP4, WebM or MOV; JPEG, PNG or WebP for posters; the browser-supplied type is not trusted), then hands it to storage. Failures at any step leave no files behind.

**Storage and Google Drive.** MongoDB stores only `{ driver, key, mimeType, size }`. `services/storage/localDriver.js` documents a four-method contract (`save`, `stat`, `createReadStream`, `remove`). To add Google Drive: write `googleDriveDriver.js` with those four methods (Drive's `files.get` with `alt=media` accepts Range headers), register it in `services/storage/index.js`, and allow `gdrive` in `STORAGE_DRIVER`. Files already stored keep working, because each one remembers which driver holds it.

**Stats.** Per-category counts only include submissions whose video still exists. Totals and daily activity always count everything. Days are UTC. Per-day bucketing is done in code from a timestamps-only query; if submissions reach hundreds of thousands, move it to a MongoDB aggregation.

**Client-reported values.** `durationSec` and `duration` come from the browser until the ffmpeg step exists to measure them on the server.

## Testing

`npm test` runs `tests/api.test.js` (31 tests): auth, roles, uploads, Range streaming, the cooldown rule (including a real elapsed-cooldown resubmission, sped up via `SUBMISSION_COOLDOWN_MS=200` in `tests/helpers.js`), stats, contact, cleanup of temp files. It calls the real HTTP stack.

- Set `MONGODB_URI_TEST` to run against a MongoDB you already have (it uses that database and **drops it**, so point it at a throwaway one).
- Otherwise it starts `mongodb-memory-server`, which downloads a MongoDB binary on first use.

## Not built yet

- **ffmpeg trimming and probing.** Submissions store `trimStart` / `trimEnd` / `mirrored` but the recording is saved untouched.
- **Frontend hookup.** `frontend/src/services/api.js` still uses the mock. When it switches: add a Vite proxy for `/api` to `http://localhost:5000` (keeps the cookie same-origin), send `credentials: 'include'`, and note that lists now come back as `{ data: [...] }`.

## Housekeeping

`package.json` still lists packages this code does not use: `bcryptjs`, `express-validator`, `morgan`, `pg`, `pg-hstore`, `sequelize`. `sequelize` is also the cause of the two moderate `npm audit` warnings (an old `uuid`). Safe to remove:

```bash
npm uninstall bcryptjs express-validator morgan pg pg-hstore sequelize
```

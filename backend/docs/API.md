# SignPak Commons API

The API is mounted below `/api/v1` (for example, `http://localhost:5000/api/v1`).
Its OpenAPI document is maintained in [`src/docs/openapi.js`](../src/docs/openapi.js).
In development, interactive Swagger UI is available at `/api/v1/docs`, `/docs`, and
`/api-docs`. Raw OpenAPI JSON is available at `/api/v1/docs.json`, `/docs.json`,
and `/api-docs.json` in all environments. Swagger UI is disabled in production.

## Authentication and cookies

Successful login and email verification set an HTTP-only `signpak_token` cookie.
Signup creates an unverified account and sends a six-digit verification code; the
account must be verified before login. Browser clients must send requests with
credentials.

`GET /auth/session` returns the current user or `null` for a visitor. `POST
/auth/logout` clears the cookie. Authenticated requests reload the user from
MongoDB, so role, suspension, deletion, and session-version changes take effect
immediately.

Verification and password-reset codes are stored as keyed hashes, expire according
to `AUTH_OTP_TTL_MINUTES`, and are subject to the configured attempt and resend
limits. Forgot-password and resend-verification endpoints use generic responses to
avoid disclosing account existence. Transactional email uses Brevo; configure
`BREVO_API_KEY` and a verified `BREVO_SENDER_EMAIL`.

## Response format

Successful JSON responses use a `data` envelope:

```json
{ "data": { "id": "..." } }
```

Errors use a consistent shape with optional field errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

`DELETE` operations that succeed return `204 No Content` with no response body.
Every request gets an `X-Request-Id` response header. A caller may supply the same
header to correlate a request with structured server logs.

## Endpoint reference

All paths below are relative to `/api/v1`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Report API uptime and database connectivity; returns `503` while the database is unavailable. |
| POST | `/auth/signup` | Public | Create an unverified contributor and send an email code. |
| POST | `/auth/login` | Public | Authenticate and set the session cookie. |
| POST | `/auth/verify-email` | Public | Verify an email code and establish a session. |
| POST | `/auth/resend-verification` | Public | Request another verification code. |
| POST | `/auth/forgot-password` | Public | Request a password-reset code. |
| POST | `/auth/reset-password` | Public | Reset a password and invalidate older sessions. |
| POST | `/auth/logout` | Public | Clear the session cookie. |
| GET | `/auth/session` | Public | Return the current user or `null`. |
| GET | `/users/me` | Authenticated user | Read the signed-in user's profile. |
| PATCH | `/users/me` | Authenticated user | Update supported profile connections. |
| GET | `/categories` | Public | List categories. |
| POST | `/categories` | Admin | Create a category. |
| PATCH | `/categories/:id` | Admin | Update a category. |
| DELETE | `/categories/:id` | Admin | Delete a category and unassign its videos. |
| GET | `/videos` | Public or admin | List published, categorised videos publicly; admins can list all. |
| GET | `/videos/:id` | Public or admin | Read a visible video. |
| GET | `/videos/:id/file` | Public or admin | Stream a visible video, including byte-range requests. |
| GET | `/videos/:id/poster` | Public or admin | Stream a visible video's poster, if present. |
| POST | `/videos` | Admin | Upload a reference video and optional poster. |
| PATCH | `/videos/:id` | Admin | Update a video, including status or category. |
| DELETE | `/videos/:id` | Admin | Delete a reference video and its base files; submissions remain. |
| GET | `/demo-video` | Public | Read the current public demo-video metadata or `null`. |
| GET | `/demo-video/file` | Public | Stream the current demo video. |
| POST | `/demo-video` | Admin | Create or replace the public demo video. |
| DELETE | `/demo-video` | Admin | Delete the demo video. |
| GET | `/submissions` | Authenticated user | List own submissions; admins can list all. |
| POST | `/submissions` | Authenticated user | Create an append-only recording submission. |
| POST | `/contact` | Signed-in account | Send a contact message using the email on the account. |
| GET | `/admin/users` | Admin | List accounts. |
| PATCH | `/admin/users/:id` | Admin | Change an account's active/suspended status. |
| DELETE | `/admin/users/:id` | Admin | Delete an account and its submissions, cooldowns, and archived recordings. |
| GET | `/admin/restrictions` | Admin | List active device and IP restrictions. |
| POST | `/admin/restrictions` | Admin | Create a permanent device or IP restriction. |
| DELETE | `/admin/restrictions/:id` | Admin | Remove a restriction. |
| GET | `/admin/stats` | Admin | Read dashboard totals, activity, and recent submissions. |
| GET | `/admin/messages` | Admin | List retained contact messages; accepts the validated `limit` query. |

There is intentionally no submission read, update, or delete endpoint, including
for admins. The archive is append-only and archived media is not streamed through
the API.

## Request bodies and uploads

Authentication and profile request schemas are defined in
[`src/middlewares/validators/`](../src/middlewares/validators/). Signup accepts
`firstName`, `surname`, `email`, `password`, and optional `confirmPassword`;
client-supplied roles are ignored. Profile updates accept supported `connections`
fields for GitHub and LinkedIn; `null` disconnects a connection.

The video and demo-video upload routes use `multipart/form-data`:

| Field | Video | Demo video |
| --- | --- | --- |
| `video` | Required video file | Required video file |
| `poster` | Optional image file | Not accepted |
| `title` | Required title | Required title |
| `categoryId` | Optional category ID | Not accepted |
| `status` | Optional video status | Not accepted |
| `durationSec` | Optional duration in seconds | Optional duration in seconds |

Submission creation uses `multipart/form-data` with a required `recording` file
and `videoId`, `trimStart`, `trimEnd`, `mirrored`, and `duration` fields. Only
published videos assigned to a category can receive a submission. Durations and
trim metadata are currently client-reported; the backend does not transcode or
physically trim the uploaded file.

Uploads are bounded by `MAX_VIDEO_UPLOAD_MB` and
`MAX_RECORDING_UPLOAD_MB` (defaults: 90 MB and 80 MB). Video signatures are
checked as MP4, WebM, or MOV. Poster signatures are checked as JPEG, PNG, or WebP;
posters must not exceed 2 MB. The browser-provided MIME type is not treated as
proof of file content.

## Contact, rate limits, and access restrictions

Contact requires a signed-in account and a submitted email matching that account.
Each account can send one message per UTC day; successful deliveries are limited
to `CONTACT_DAILY_LIMIT` per UTC day (default 25). Delivery uses Web3Forms and
successful messages are retained for the admin inbox. Anonymous or mismatched
requests, and requests after the global daily cap, temporarily restrict the
request's device ID or IP for `CONTACT_ABUSE_BLOCK_MINUTES` (default 10).

When `RATE_LIMIT_ENABLED=true`, the API has a global limit of 1,000 requests per
15 minutes, auth endpoints allow 20 attempts per 15 minutes, contact allows 5
requests per hour, and upload endpoints allow 60 requests per 15 minutes. The
contact-account and daily delivery quotas are separate from these HTTP limits.
Admin routes remain accessible when an IP/device restriction is active so an
administrator can recover by removing a restriction.

## Visibility and data rules

- Anonymous visitors see only published videos assigned to a category. Admins can
  see drafts and unassigned videos.
- A video's file and poster use the same visibility check as its metadata.
- Contributors see only their own submission metadata. Admins can see all
  submissions and archive metadata; contributor responses omit archive paths.
- Archived recording bytes are never readable through the API.
- Deleting a category unassigns videos rather than deleting them. Deleting a
  reference video keeps submissions associated with that video on record.
- A contributor may submit the same video again after the
  `SUBMISSION_COOLDOWN_MS` cooldown (default 30 seconds). Concurrent submissions
  for the same account/video pair are atomically limited.

For the detailed OpenAPI schemas and examples, use the raw OpenAPI document or
the development Swagger UI.

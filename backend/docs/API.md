# SignPak Commons API

The API is mounted below `/api/v1` (for example, `http://localhost:5000/api/v1`).
Its OpenAPI document is maintained in [`src/docs/openapi.js`](../src/docs/openapi.js).
In development, interactive Swagger UI is available at `/api/v1/docs`, `/docs`, and
`/api-docs`. Raw OpenAPI JSON is available at `/api/v1/docs.json`, `/docs.json`,
and `/api-docs.json` in all environments. Swagger UI is disabled in production.

## Authentication and cookies

Successful login and consent acceptance set an HTTP-only `signpak_token` cookie.
Signup creates a pending, unverified record and sends a six-digit verification
code. A valid code returns a short-lived consent token but does not establish a
session or activate the account. `POST /auth/consent` accepts the current notice,
activates the account, stores the consent version and timestamp, and starts the
session. `POST /auth/decline-consent` discards the pending signup. Existing
contributors without current consent are redirected to the notice and cannot
submit recordings until they accept. Browser clients must send requests with
credentials.

`GET /auth/session` returns the current user or `null` for a visitor. `POST
/auth/logout` clears the cookie and, with a valid session, **ends every session of
the account on every device** (S6): it bumps the account's session version, so any
copy of the old token stops working. A password reset or a password change does the
same. Authenticated requests reload the user from MongoDB, so role, suspension,
deletion, and session-version changes take effect immediately.

**Lockout (S2, SE-4).** `AUTH_LOCKOUT_ATTEMPTS` (5) wrong passwords in a row lock
the account for `AUTH_LOCKOUT_MINUTES` (15): the attempt that locks it and every login
until then answer `429` with code `ACCOUNT_LOCKED` ("Too many failed attempts. Try
again in 15 minutes."), even with the right password. A successful login, a password
reset or a password change resets the count. An unknown email is never locked and
takes as long to refuse as a known one. A wrong current password on `POST
/users/me/password` counts the same way, and while the account is locked that route
also answers 429 `ACCOUNT_LOCKED`; the lock doesn't end the session already open.

**Sign-up.** `POST /auth/signup` answers 201 `{ email, verificationEmailSent }`. For an
email whose sign-up was never finished it does the same (B3): the names and password are
updated, the 24-hour expiry restarts, and the code is resent unless one went out in the
last `AUTH_OTP_RESEND_SECONDS`. A finished account still gets 409. `POST
/auth/verify-email` takes `{ email, code, password }`: the password chosen at sign-up is
checked with the code (a wrong one is 422 on `password` and uses up an attempt), so only
the person who set the latest password can finish. A re-signup also bumps the account's
session version, and the consent token carries the version it was issued for (claim `v`):
a token from before a re-signup is refused by `POST /auth/consent` and `POST
/auth/decline-consent` with 400 "This sign-up step has expired. Verify your email again to
continue." So nobody can slip their own details in between someone else's verification
and consent. Unfinished sign-ups are deleted 24
hours after the latest sign-up (S9, a TTL index on `signupExpiresAt` limited to
unverified contributor accounts).

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
| GET | `/health` | Public | Report uptime, database connectivity and whether storage initialized. `200` with `status: ok` only when both are up; otherwise `503` with `status: degraded`. Booleans only, and it answers even when initialization failed. |
| POST | `/auth/signup` | Public | Create an unverified contributor and send an email code. |
| POST | `/auth/login` | Public | Authenticate and set the session cookie. |
| POST | `/auth/verify-email` | Public | Verify an email code with the sign-up password and return a short-lived consent token. |
| POST | `/auth/consent` | Public | Accept the current consent notice, activate a pending signup, and start a session. |
| POST | `/auth/decline-consent` | Public | Discard a pending signup after consent is declined. |
| POST | `/auth/resend-verification` | Public | Request another verification code. |
| POST | `/auth/forgot-password` | Public | Request a password-reset code. |
| POST | `/auth/reset-password` | Public | Reset a password and invalidate older sessions. |
| POST | `/auth/logout` | Public | Clear the session cookie; with a session, end every session of the account (S6). |
| GET | `/auth/session` | Public | Return the current user or `null`. |
| GET | `/users/me` | Authenticated user | Read the signed-in user's profile. |
| PATCH | `/users/me` | Authenticated user | Update supported profile connections. |
| DELETE | `/users/me` | Contributor | Delete the account after confirming the current password; submitted recordings and contribution data remain stored. |
| POST | `/users/me/consent` | Authenticated user | Accept the current notice for an existing account. |
| POST | `/users/me/password` | Authenticated user | Change the password: `{ currentPassword, password, confirmPassword }`. 401 for a wrong current password (counts toward the lockout), 429 `ACCOUNT_LOCKED` while locked, 422 for a mismatch or the same password; 204 with a new cookie. Every other session ends. |
| GET | `/categories` | Public | List categories. |
| POST | `/categories` | Admin | Create a category. |
| PATCH | `/categories/:id` | Admin | Update a category. |
| DELETE | `/categories/:id` | Admin | Delete a category and unassign its videos. |
| GET | `/videos` | Public or admin | List published, categorised videos publicly; admins can list all. |
| GET | `/videos/:id` | Public or admin | Read a visible video. |
| GET | `/videos/:id/file` | Public or admin | Stream a visible video, including byte-range requests. |
| GET | `/videos/:id/poster` | Public or admin | Stream a visible video's poster, if present. |
| POST | `/videos` | Admin | Upload a reference video or register a direct HTTPS video URL; URL sources require a poster. |
| PATCH | `/videos/:id` | Admin | Update a video, including status or category. |
| DELETE | `/videos/:id` | Admin | Delete a reference video and its base files; submissions remain. |
| GET | `/demo-video` | Public | Read the current public demo-video metadata or `null`. |
| GET | `/demo-video/file` | Public | Stream the current demo video. |
| POST | `/demo-video` | Admin | Create or replace the public demo video. |
| DELETE | `/demo-video` | Admin | Delete the demo video. |
| GET | `/submissions` | Authenticated user | List own submissions; admins can list all. |
| POST | `/submissions` | Authenticated user | Create an append-only recording submission. |
| POST | `/contact` | Signed-in account or recording-deletion request | Other topics require the account email; deletion requests can be submitted without signing in before or after account deletion, at any time. |
| GET | `/admin/users` | Admin | List accounts. |
| PATCH | `/admin/users/:id` | Admin | Change an account's active/suspended status. |
| DELETE | `/admin/users/:id` | Admin | Delete an account and its cooldown claims; submitted recordings and contribution data remain stored. With `?withRecordings=true` the recordings are deleted first (C3), and the account is kept (409) if any file can't be deleted. |
| GET | `/admin/users/:id/submissions` | Admin | One page of a contributor's submissions, newest first: `?limit=` (1–100, default 20) and `?cursor=` (the previous page's `nextCursor`). Returns `{ items, total, nextCursor }`. Works for a deleted account's id. |
| DELETE | `/admin/users/:id/submissions` | Admin | Delete all of a contributor's recordings (C3); optional `?requestMessageId=`. Returns `{ deleted, failed: [{ id, reason }] }`. |
| GET | `/admin/deletion-lookup` | Admin | Find whose recordings a deletion request is about: `?messageId=` or `?email=` (exactly one). Returns `{ matches }`. |
| GET | `/admin/restrictions` | Admin | List active device and IP restrictions. |
| POST | `/admin/restrictions` | Admin | Create a permanent device or IP restriction. |
| DELETE | `/admin/restrictions/:id` | Admin | Remove a restriction. |
| GET | `/admin/stats` | Admin | Read dashboard totals, activity, and recent submissions. |
| GET | `/admin/messages` | Admin | List retained contact messages, newest first. Query: `limit` (1–200, default 50), `topic`, `status` (`open`, `done`, `rejected`), `verified` (`true`/`false`). |
| PATCH | `/admin/messages/:id` | Admin | Set `{ status }`: `done` and `rejected` record `handledAt` and `handledBy`; `open` clears them. |

A submission is never updated, and archived media is not streamed through the API.
Account deletion leaves submissions intact; a separate recording/data deletion
request (the contact form) asks the team to remove them. Requests may be sent before
or after account deletion, without a deadline. Recordings already used in a released
model cannot be removed from that model.

### Acting on a deletion request (C3)

The only way submissions are deleted is an admin acting on such a request:

1. `GET /admin/deletion-lookup?messageId=<message id>` takes the email from the
   message and returns every match: the current account using it (`kind: "user"`,
   with name, email, role and status) and any deleted account it used to belong to
   (`kind: "deleted"`, with `deletedAt` and `deletedBy`). Each has `userId` and
   `submissionCount`. Deleted accounts are found through a keyed hash of the email
   (`EMAIL_HASH_SECRET`), kept in a `DeletedAccount` record whenever an account is
   deleted; the address itself is not kept. `?email=` works too for a direct call, and
   the request log redacts it.
2. `DELETE /admin/users/:userId/submissions?requestMessageId=<message id>` removes
   each recording file from storage, then its Submission document, then the
   contributor's cooldowns. A file that can't be removed is listed in `failed` and
   **keeps its document**, so calling the route again finishes the job.
3. Every call writes a `DeletionLog`: `userId`, the email hash (never the email), the
   numbers deleted and failed, `accountDeleted`, `requestMessageId`, the admin's id and
   the time. It is append-only.
4. `PATCH /admin/messages/:id { "status": "done" }` closes the request.

## Request bodies and uploads

Authentication and profile request schemas are defined in
[`src/middlewares/validators/`](../src/middlewares/validators/). Signup accepts
`firstName`, `surname`, `email`, `password`, and optional `confirmPassword`;
client-supplied roles are ignored. Profile updates accept supported `connections`
fields for GitHub and LinkedIn; `null` disconnects a connection.

The video and demo-video creation routes use `multipart/form-data`:

| Field | Video | Demo video |
| --- | --- | --- |
| `video` | Optional video file; provide this or `videoUrl`, but not both | Required video file |
| `videoUrl` | Optional direct HTTPS MP4/WebM URL; provide this or `video`, but not both | Not accepted |
| `poster` | Optional for uploaded files; required with `videoUrl` | Not accepted |
| `title` | Required title | Required title |
| `categoryId` | Optional category ID | Not accepted |
| `status` | Optional video status | Not accepted |
| `durationSec` | Optional duration in seconds | Optional duration in seconds |
| `width` | Optional displayed width in pixels | Optional displayed width in pixels |
| `height` | Optional displayed height in pixels | Optional displayed height in pixels |

`width` and `height` are integers from 0 through 16,384 and default to `0`
when omitted or unknown. They are reported by the admin's browser during video
preparation (including rotation metadata); the API stores the values but does
not probe media files to verify them. The frontend uses the stored dimensions
to size responsive video frames before playback metadata loads.

Submission creation uses `multipart/form-data` with a required `recording` file
and `videoId`, `trimStart`, `trimEnd`, `mirrored`, and `duration` fields. Only
published videos assigned to a category can receive a submission. Durations and
trim metadata are currently client-reported; the backend does not transcode or
physically trim the uploaded file. Submission duration must not exceed 600
seconds (10 minutes).

Uploads are bounded by `MAX_VIDEO_UPLOAD_MB` and
`MAX_RECORDING_UPLOAD_MB` (defaults: 90 MB and 100 MB). Video signatures are
checked as MP4, WebM, or MOV. Poster signatures are checked as JPEG, PNG, or WebP;
posters must not exceed 2 MB. The browser-provided MIME type is not treated as
proof of file content. External URLs must point directly to media playable in a
native HTML `<video>` element; YouTube and other watch-page URLs are not
supported. The URL is stored in MongoDB. Its poster image is stored through the
configured `STORAGE_DRIVER` and streamed from the API.

Poster responses use a private five-minute browser cache. When Upstash Redis is
configured, the backend also caches poster file metadata for five minutes; it
does not cache poster image bytes. Redis errors are logged and fall back to
reading metadata from the configured storage driver.

## Contact, rate limits, and access restrictions

`POST /api/v1/contact` takes `{ topic, name, email, message }`, where `topic` is
`general`, `partnership` or `recording-deletion` (default `general`). Delivery uses
Web3Forms and every delivered message is kept for the admin inbox. The rules
(FIX-PLAN section 0, S4 and D4):

| Sender | Topics | Limits | Deletion request |
| --- | --- | --- | --- |
| Signed in | all three; `email` must match the account (else 403) | one general/partnership message per UTC day (`CONTACT_USER_DAILY_LIMIT`, 409 when used); deletion requests don't count | verified at once |
| Signed out | `recording-deletion` only (anything else 403) | `CONTACT_SENDER_DAILY_LIMIT` (default 2) per IP **and** per device per UTC day (429) | verified with an emailed code |

General and partnership messages share a site-wide cap of `CONTACT_DAILY_LIMIT`
per UTC day (default 25; 429 once reached). Deletion requests are exempt from it,
so nobody can use the cap up to stop others asking for their data to be deleted.
None of these refusals ever restricts the device or IP: they are plain 403, 409 and
429 answers.

The `201` body is `{ data: { received: true, id, verificationRequired } }`.
`verificationRequired` is `true` only for a signed-out deletion request: if an
account uses that email, a six-digit code is emailed to it (it expires after
`AUTH_OTP_TTL_MINUTES` and dies after `AUTH_OTP_MAX_ATTEMPTS` wrong tries). The
answer is the same whether or not an account exists. A request for an email with
no account stays unverified and is checked by hand by the team.

- `POST /api/v1/contact/:id/verify` with `{ code }` returns `200 { data: { verified: true } }`.
  A wrong, expired or used-up code, or an unknown id, returns the same
  `400 BAD_REQUEST` ("That code is invalid or has expired…").
- `POST /api/v1/contact/:id/resend` returns `202 { data: { message } }` with the same
  message whether or not an account exists, and emails a new code only when one
  does. It returns 429 within `AUTH_OTP_RESEND_SECONDS` (default 60) of the last send,
  and 429 "This request has had too many codes. Send a new request tomorrow." once the
  request has had 5 codes, the first one included. Both checks count requests for an
  email with no account too, so the answers are the same either way. Two simultaneous
  resends can't both pass. For a request that needs no code (signed-in or already
  verified) it returns 400.

At most `CONTACT_CODE_EMAILS_PER_DAY` (default 5) deletion-request code emails go to
one address per UTC day, across all requests and senders. Past that no code is sent,
but the answer is exactly the same as when one is. This stops anyone flooding an
inbox, or using up the Brevo daily quota that sign-up and password-reset codes need.

Both code routes are limited to 20 requests per 15 minutes per IP when rate limiting
is on. Admins see `verified`, `status` (`open`, `done`, `rejected`), `handledAt` and
`handledBy` on each message in `GET /api/v1/admin/messages`; the code fields are never
returned.

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
  `SUBMISSION_COOLDOWN_MS` cooldown (default 30 seconds), measured from when the
  server starts processing the upload request. The submission response includes
  `cooldownStartedAt` so the client countdown uses the same timestamp. Concurrent
  submissions for the same account/video pair are atomically limited.

For the detailed OpenAPI schemas and examples, use the raw OpenAPI document or
the development Swagger UI.

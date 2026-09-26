# SignPak Commons API

The interactive API reference is available while the backend is running:

- Swagger UI: `http://localhost:5000/api/v1/docs`
- Swagger UI aliases: `http://localhost:5000/docs` or `http://localhost:5000/api-docs`
- OpenAPI JSON: `http://localhost:5000/api/v1/docs.json`
- OpenAPI JSON aliases: `/docs.json` or `/api-docs.json`
- API base URL: `http://localhost:5000/api/v1`

The OpenAPI document is maintained in [`src/docs/openapi.js`](../src/docs/openapi.js). Keep it synchronized with the route files and validators when changing the API.

## Authentication

Login and successful email verification set an HTTP-only `signpak_token` cookie. Signup creates an unverified account and emails a six-digit code; browser clients must verify it before logging in. Browser requests must send credentials.

The cookie is cleared by `POST /auth/logout`. `GET /auth/session` is public and returns the current user when a valid session exists, or `null` for a visitor.

Verification and password reset codes are stored as keyed hashes, expire after `AUTH_OTP_TTL_MINUTES`, and have bounded attempts and resend intervals. Password reset responses do not reveal whether an email exists. Configure `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (a verified Brevo sender), and optionally `BREVO_SENDER_NAME` in the backend environment.

## Response format

JSON success responses use:

```json
{ "data": { "id": "..." } }
```

Errors use a structured object suitable for form-level and field-level messages:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

`204 No Content` responses have no body. Responses include `X-Request-Id`, which can be supplied by a client and matched against server logs.

## Endpoint summary

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Check API and database status. |
| POST | `/auth/signup` | Public | Create an unverified contributor and send a verification code. |
| POST | `/auth/login` | Public | Create a session. |
| POST | `/auth/verify-email` | Public | Verify a code and establish a session. |
| POST | `/auth/resend-verification` | Public | Resend a verification code with a generic response. |
| POST | `/auth/forgot-password` | Public | Request a password reset code with a generic response. |
| POST | `/auth/reset-password` | Public | Reset password and invalidate existing sessions. |
| POST | `/auth/logout` | Public | Clear the session. |
| GET | `/auth/session` | Public | Read the current session. |
| GET/PATCH | `/users/me` | User | Read or update the current profile. |
| GET | `/categories` | Public | List categories. |
| POST/PATCH/DELETE | `/categories`, `/categories/:id` | Admin | Manage categories. |
| GET | `/videos`, `/videos/:id` | Public | List or read visible video metadata. |
| GET | `/videos/:id/file` | Public when published | Stream a published reference video. |
| GET | `/videos/:id/poster` | Public when published | Stream a published poster. |
| POST/PATCH/DELETE | `/videos`, `/videos/:id` | Admin | Upload and manage base videos. |
| GET | `/demo-video`, `/demo-video/file` | Public | Read metadata or stream the current walkthrough video. |
| POST/DELETE | `/demo-video` | Admin | Upload/replace or delete the walkthrough video. |
| GET/POST | `/submissions` | User | List or create contributor recordings. |
| GET | `/submissions/:id/recording` | None | Deliberately unavailable; submission archives are append-only. |
| POST | `/contact` | Verified user | Send a message from the account email; one per account per UTC day. |
| GET | `/admin/users` | Admin | List users. |
| GET | `/admin/stats` | Admin | Read dashboard statistics. |
| GET | `/admin/messages` | Admin | Read contact messages. |

## Uploads

Video creation uses `multipart/form-data` with `video`, optional `poster`, `title`, optional `categoryId`, `status`, and `durationSec`. Submission creation uses `multipart/form-data` with `recording`, `videoId`, `trimStart`, `trimEnd`, `mirrored`, and `duration`.

The public demo video is a separate singleton asset, independent of the lesson library. Admin uploads use `multipart/form-data` with `video`, `title`, and optional `durationSec`; uploading replaces the current demo asset.

The server validates file signatures, size limits, metadata, and route IDs. Client-reported durations are currently accepted for trimming metadata; server-side media probing and trimming are future work.

Contact messages are delivered to the recipient configured by the `WEB3FORMS_ACCESS_KEY` in Web3Forms and are also retained in the admin inbox. Only authenticated users can send, the submitted email must match their account, each account can send one message per UTC day, and total successful deliveries are capped at 25 per UTC day. Anonymous or email-mismatched attempts, and attempts after the global cap, temporarily restrict that device (or IP if no device ID is supplied) for 10 minutes.

## Visibility rules

- Anonymous users see only published videos assigned to a category.
- Admins can list and manage draft, published, and unassigned videos.
- Contributor submissions are private to their owner in `/submissions`.
- Submission recordings are never readable through the API, including by admins. Admins can access the MongoDB submission record and its archive metadata.
- Archive paths follow `commons/{userId}_{sequence}/{category_slug}/{video_slug}/{video_slug}.{ext}`. A repeated submission for the same user and video increments `sequence` instead of overwriting the previous file.
- Video reference files are public only when the corresponding video passes the same published visibility check.

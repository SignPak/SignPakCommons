# SignPak Commons API

The interactive API reference is available while the backend is running:

- Swagger UI: `http://localhost:5000/api/v1/docs`
- Swagger UI aliases: `http://localhost:5000/docs` or `http://localhost:5000/api-docs`
- OpenAPI JSON: `http://localhost:5000/api/v1/docs.json`
- OpenAPI JSON aliases: `/docs.json` or `/api-docs.json`
- API base URL: `http://localhost:5000/api/v1`

The OpenAPI document is maintained in [`src/docs/openapi.js`](../src/docs/openapi.js). Keep it synchronized with the route files and validators when changing the API.

## Authentication

Signup and login set an HTTP-only `signpak_token` cookie. Browser clients must send requests with credentials enabled. Swagger UI can describe the cookie scheme, but browser authentication is normally established by calling `/auth/signup` or `/auth/login` first.

The cookie is cleared by `POST /auth/logout`. `GET /auth/session` is public and returns the current user when a valid session exists, or `null` for a visitor.

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
| POST | `/auth/signup` | Public | Create a contributor account and session. |
| POST | `/auth/login` | Public | Create a session. |
| POST | `/auth/logout` | Public | Clear the session. |
| GET | `/auth/session` | Public | Read the current session. |
| GET/PATCH | `/users/me` | User | Read or update the current profile. |
| GET | `/categories` | Public | List categories. |
| POST/PATCH/DELETE | `/categories`, `/categories/:id` | Admin | Manage categories. |
| GET | `/videos`, `/videos/:id` | Public | List or read visible video metadata. |
| GET | `/videos/:id/file` | Public when published | Stream a published reference video. |
| GET | `/videos/:id/poster` | Public when published | Stream a published poster. |
| POST/PATCH/DELETE | `/videos`, `/videos/:id` | Admin | Upload and manage base videos. |
| GET/POST | `/submissions` | User | List or create contributor recordings. |
| GET | `/submissions/:id/recording` | Admin | Stream a contributor recording. |
| POST | `/contact` | Public | Send a contact message. |
| GET | `/admin/users` | Admin | List users. |
| GET | `/admin/stats` | Admin | Read dashboard statistics. |
| GET | `/admin/messages` | Admin | Read contact messages. |

## Uploads

Video creation uses `multipart/form-data` with `video`, optional `poster`, `title`, optional `categoryId`, `status`, and `durationSec`. Submission creation uses `multipart/form-data` with `recording`, `videoId`, `trimStart`, `trimEnd`, `mirrored`, and `duration`.

The server validates file signatures, size limits, metadata, and route IDs. Client-reported durations are currently accepted for trimming metadata; server-side media probing and trimming are future work.

## Visibility rules

- Anonymous users see only published videos assigned to a category.
- Admins can list and manage draft, published, and unassigned videos.
- Contributor submissions are private to their owner in `/submissions`.
- Only admins can stream submission recordings.
- Video reference files are public only when the corresponding video passes the same published visibility check.

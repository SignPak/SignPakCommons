# Backend module reference

For system startup, request flow, and persistence details, see
[ARCHITECTURE.md](ARCHITECTURE.md). This page maps common changes to their
implementation layers.

| Concern | Primary modules | Notes |
| --- | --- | --- |
| App composition and startup | `server.js`, `src/app.js`, `src/services/initialization.js` | App composition is importable without binding a listener; initialization is shared and idempotent. |
| Routes and access policy | `src/routes/`, `src/middlewares/authenticate.js`, `src/middlewares/requireRole.js` | Route definitions compose auth and validation middleware. |
| Request validation | `src/middlewares/validators/`, `src/middlewares/validate.js` | Zod schemas validate bodies, params, and queries. |
| HTTP response/error boundary | `src/controllers/`, `src/utils/response.js`, `src/middlewares/errorHandler.js` | Controllers adapt HTTP; services should throw `AppError` for expected failures. |
| Domain behavior | `src/services/` | Enforce permissions, visibility, retention, cooldown, and multi-step workflows here. |
| MongoDB persistence | `src/models/`, `src/repositories/` | Schemas define serialization/indexes; repositories encapsulate queries. |
| Video library | `src/models/Video.js`, `src/services/videoService.js`, `src/routes/videoRoutes.js` | Supports stored uploads and direct HTTPS video URLs; posters are stored files. |
| File storage | `src/services/storage/`, `src/utils/sendFile.js` | Local and Google Drive drivers; `sendFile` handles byte ranges and headers. |
| Redis cache | `src/services/cache/upstashRedis.js`, feature service | Optional Upstash Redis REST client. Feature services own key naming, TTL, validation, and fallback logging. |
| Authentication and consent | `src/services/authService.js`, `src/controllers/authController.js`, auth validators | Signup does not activate until the current consent is accepted. |
| Submissions and archive | `src/services/submissionService.js`, `src/repositories/submissionRepo.js` | Submission records are append-only; archive storage is selected independently. |
| API specification | `src/docs/openapi.js`, `docs/API.md` | Update both with route, schema, or response changes. |
| Tests | `tests/*.test.js` | API-level suites plus focused service, filesystem, and utility suites. |

## Typical request path

```text
route -> middleware -> controller -> service -> repository/model
                                  -> storage/provider integration
```

Keep domain policy in services and persistence mechanics in repositories or
storage drivers. Preserve error propagation and log provider/cache failures
using the established logger.

## Validation checklist

For behavior changes, add focused tests at the service layer and API boundary
where practical. Run the relevant test file, then `npm test` for broader
changes. API and storage test setup is described in
[SETUP.md](SETUP.md) and the [test-case inventory](TEST-CASES.md).

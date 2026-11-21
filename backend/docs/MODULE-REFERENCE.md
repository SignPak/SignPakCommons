# Backend module reference

For system startup, request flow, and persistence details, see
[ARCHITECTURE.md](ARCHITECTURE.md). This page maps common changes to their
implementation layers.

| Concern | Primary modules | Notes |
| --- | --- | --- |
| App composition and startup | `server.js`, `src/app.js`, `src/services/initialization.js`, `src/config/startupChecks.js`, `src/utils/gracefulShutdown.js` | App composition is importable without binding a listener; initialization is shared and idempotent; startup warnings and graceful shutdown live in their own testable modules. |
| Health | `src/controllers/healthController.js` | Public; booleans only; answers even when initialization failed. |
| Deployment | `deploy/` (Nginx, PM2, `deploy.sh`, server guide), `backend/.env.production.example` | Nginx + PM2 on the team's own server. Keep `deploy/` and the deploy-config tests in step. |
| Routes and access policy | `src/routes/`, `src/middlewares/authenticate.js`, `src/middlewares/requireRole.js` | Route definitions compose auth and validation middleware. |
| Request validation | `src/middlewares/validators/`, `src/middlewares/validate.js` | Zod schemas validate bodies, params, and queries. |
| HTTP response/error boundary | `src/controllers/`, `src/utils/response.js`, `src/middlewares/errorHandler.js` | Controllers adapt HTTP; services should throw `AppError` for expected failures. |
| Domain behavior | `src/services/` | Enforce permissions, visibility, retention, cooldown, and multi-step workflows here. |
| MongoDB persistence | `src/models/`, `src/repositories/` | Schemas define serialization/indexes; repositories encapsulate queries. |
| Video library | `src/models/Video.js`, `src/services/videoService.js`, `src/routes/videoRoutes.js` | Supports stored uploads and direct HTTPS video URLs; posters are stored files. |
| File storage | `src/services/storage/`, `src/utils/sendFile.js`, `src/utils/files.js` | Local and Google Drive drivers; temp files are deleted after every save and swept at startup; `sniffVideo` decides accepted video by bytes and brand; `sendFile` handles byte ranges and headers. Tests can route storage to `tests/support/fakeDriveDriver.js` with `routeStorageForTests()` (refuses outside `NODE_ENV=test`). |
| Failure clean-up | `src/utils/cleanup.js` | `attemptCleanup()`: one clean-up step that logs and continues, so the original error is always the one rethrown. |
| Redis cache | `src/services/cache/upstashRedis.js`, feature service | Optional Upstash Redis REST client. Feature services own key naming, TTL, validation, and fallback logging. |
| Authentication and consent | `src/services/authService.js`, `src/controllers/authController.js`, auth validators; lockout and sign-up expiry in `src/repositories/userRepo.js` and `src/models/User.js` (`SIGNUP_TTL_INDEX`) | Lockout (S2), logout everywhere and password change (S6), sign-up expiry and re-signup (S9, B3) live here. Signup does not activate until the current consent is accepted. |
| Submissions and archive | `src/services/submissionService.js`, `src/repositories/submissionRepo.js` | Submission records are append-only; archive storage is selected independently. |
| API specification | `src/docs/openapi.js`, `docs/API.md` | Update both with route, schema, or response changes. |
| Contact form and deletion requests | `src/services/contactService.js`, `src/repositories/contactQuotaRepo.js`, `src/repositories/messageRepo.js`, `src/models/ContactMessage.js`, `src/models/ContactSenderQuota.js`, `src/utils/otp.js` | FR13.13. Quotas answer 403/409/429 and never restrict a device (S4). Signed-out deletion requests are confirmed with an emailed code sent after the response, so the answer never reveals whether an account exists (D4). `deliver` is the Web3Forms call; tests and the E2E server replace it. |
| Deletion requests: admin side (C3) | `src/services/submissionService.js` (`removeAllForUser`, `pageForUser`), `src/services/deletionLookupService.js`, `src/services/userService.js` (`withRecordings`, `DeletedAccount`), `src/models/DeletionLog.js`, `src/models/DeletedAccount.js`, `src/repositories/deletionRepo.js`, `src/utils/emailHash.js` | The only code that deletes submissions. Failed files keep their document so a retry finishes. Deletion records hold an HMAC of the email (`EMAIL_HASH_SECRET`, never change it), never the address. `requestLogSerializer` (`src/utils/requestLog.js`) redacts `email=` from logged URLs. |
| Admins and the activity log (S7) | `src/services/authService.js` (`syncAdmins`), `src/services/auditService.js`, `src/repositories/auditRepo.js`, `src/models/AuditLog.js`, `AUDIT_ACTIONS` in `src/config/constants.js` | `ADMIN_EMAILS` is parsed in `env.js` (`env.adminEmails`). Services, not controllers, call `auditService.record()` after the action succeeds; a failed write is logged, never thrown. A new admin action needs a name in `AUDIT_ACTIONS` and a label in the frontend's `src/utils/auditLog.js`. |
| Email delivery | `src/services/email/`, `src/services/external/sendOTPBrevo.js` | `EMAIL_DRIVER` selects Brevo or the in-memory capture driver used by tests. |
| Test-only hooks | `src/routes/testHooks.js` | `GET /__test/emails`, mounted only when `NODE_ENV=test` and `E2E_TEST_HOOKS=true`. |
| Tests | `tests/unit/`, `tests/integration/`, `tests/security/` | One folder per level, with shared fixtures in `tests/support/`. |
| Coverage gate | `.c8rc.json`, `coverage-thresholds.json`, `scripts/check-coverage.js` | Per-directory floors; raise them, never lower them. |

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
changes, and `npm run test:coverage` before opening a pull request. A new route
also needs an entry in `tests/security/access-matrix.test.js`, which fails if a
registered route has no access decision. API and storage test setup is described
in [setup.md](setup.md) and the [test-case inventory](TEST-CASES.md).

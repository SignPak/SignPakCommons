# Backend Agent Guide

## Scope

These instructions apply to work under `backend/`. Preserve the dependency
direction: routes and middleware call controllers; controllers call services;
services own domain rules and call repositories or integrations; repositories
own persistence queries. Services must not read Express `req` or write `res`.

## Commands

Run from `backend/`:

```sh
npm run dev
npm run test:unit
npm run test:integration
npm run test:security
npm test                 # all three
npm run test:coverage    # c8 plus the floors in coverage-thresholds.json
npm test -- tests/integration/api-videos.test.js
```

The test runner is Node's built-in serial runner. Tests are split by level:
`tests/unit/`, `tests/integration/`, `tests/security/`, with shared fixtures in
`tests/support/`. Integration and security tests use MongoDB Memory Server by
default; if `MONGODB_URI_TEST` is configured, tests drop that database, so only
use a disposable one. Authentication email goes through the in-memory capture
driver in tests (`EMAIL_DRIVER`), so nothing is sent.

End-to-end tests live in `e2e/` at the repository root. `npm run e2e:server`
here starts the API they run against.

### Lockfiles

CI installs with the npm that ships with Node 22 (npm 10). npm 11 prunes lock entries that
npm 10 still requires, so a lockfile written by npm 11 fails `npm ci` on CI with
"Missing: <package> from lock file". After changing dependencies, regenerate the lockfile
with npm 10:

```sh
npx npm@10 install --package-lock-only
```

Then check both: `npx npm@10 ci --dry-run` and `npm ci --dry-run`.

## Guardrails

- Never commit `.env`, credentials, tokens, service-account JSON, or production
  data. Environment variables are validated in `src/config/env.js`; update
  `.env.example` and `docs/setup.md` when adding configuration.
- Keep Zod request validation in `src/middlewares/validators/` and business
  rules in services. Use shared response and `AppError` helpers.
- Verify file contents from signatures, not supplied MIME types. Route uploads
  through the storage service and preserve cleanup for partially completed
  multi-file operations.
- MongoDB stores domain records and opaque storage references; media bytes
  belong to configured storage drivers. Preserve visibility checks for
  metadata and media routes.
- Redis is optional Upstash. Cache failures should be logged and fall back to
  the authoritative database/storage path. Keep cache values small and apply
  explicit TTLs.
- Update `src/docs/openapi.js`, `docs/API.md`, tests, and relevant architecture
  docs when changing endpoints or behavior. Do not silently change append-only
  submission or account-data retention behavior.
- Add every new route to the access matrix in
  `tests/security/access-matrix.test.js`; the suite fails on a route with no
  access decision. Add a test at each level the change touches, and never lower
  a coverage floor.
- Keep test-only behavior unreachable in production. `EMAIL_DRIVER=capture` and
  `E2E_TEST_HOOKS` are rejected by `src/config/env.js` when
  `NODE_ENV=production`; keep it that way.

## References

- [Backend docs index](docs/README.md)
- [Setup and environment](docs/setup.md)
- [API contract](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Module reference](docs/MODULE-REFERENCE.md)
- [Design decisions](docs/design-docs/ARCHITECTURE-DECISIONS.md)
- [Test-case inventory](docs/TEST-CASES.md)

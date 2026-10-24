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
npm test
npm test -- tests/api-videos.test.js
```

The test runner is Node's built-in serial runner. API tests use MongoDB Memory
Server by default. If `MONGODB_URI_TEST` is configured, tests drop that
database; only use a disposable test database.

## Guardrails

- Never commit `.env`, credentials, tokens, service-account JSON, or production
  data. Environment variables are validated in `src/config/env.js`; update
  `.env.example` and `docs/SETUP.md` when adding configuration.
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

## References

- [Backend docs index](docs/README.md)
- [Setup and environment](docs/SETUP.md)
- [API contract](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Module reference](docs/MODULE-REFERENCE.md)
- [Design decisions](docs/design-docs/ARCHITECTURE-DECISIONS.md)
- [Test-case inventory](docs/TEST-CASES.md)

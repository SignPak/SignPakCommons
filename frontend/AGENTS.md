# Frontend Agent Guide

## Scope

These instructions apply to work under `frontend/`. Start with the relevant
screen, provider, service, hook, and test; follow existing patterns before
adding abstractions. The Express API is authoritative for persisted users,
categories, videos, and submissions.

## Commands

Run from `frontend/`:

```sh
npm run dev
npm run lint
npm test
npm run build
```

Use the smallest relevant test file when practical. The Vite development server
proxies `/api` to `http://localhost:5000`; start the backend separately.

## Guardrails

- Do not put credentials or private keys in `VITE_*` variables; they are exposed
  in the browser bundle. Keep local secrets in an untracked `.env.local`.
- Keep API calls in `src/services/api.js` and URL construction in
  `src/services/apiRoutes.js`; surface backend error messages instead of
  silently replacing failures with success-shaped defaults.
- Auth-shell forms use React Hook Form with Zod resolvers. Validate auth request
  payloads with the matching Zod schemas at the API-client boundary as well;
  backend Zod validators remain the final authority.
- Keep camera capture, unsubmitted recordings, and queued uploads in their
  established providers. Unsubmitted recordings and the upload queue are
  intentionally memory-only.
- Preserve media lifecycle cleanup: release object URLs, stop camera tracks,
  and do not revoke a video URL while its player still uses it.
- External base videos are direct HTTPS media URLs, not embedded watch pages.
  Browser-side Blob caching requires source CORS; keep the network-playback
  fallback when caching is unavailable.
- Update relevant frontend tests and docs when user-visible behavior or the API
  contract changes. Do not edit generated build output in `dist/`.

## References

- [Frontend docs index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Module reference](docs/MODULE-REFERENCE.md)
- [Design decisions](docs/design-docs/ARCHITECTURE-DECISIONS.md)
- [Frontend setup and routes](README.md)
- [Backend API](../backend/docs/API.md)

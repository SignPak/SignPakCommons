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
npm test                 # unit + integration (Vitest)
npm run test:unit
npm run test:integration
npm run test:coverage    # thresholds live in vite.config.js
npm run build
```

Unit tests live in `test/unit/` and mock `src/services/api` directly. Page-level
integration tests live in `test/integration/`, render the real providers and API
client, and mock only the network with MSW through `test/support/mswServer.js`.

Use the smallest relevant test file when practical. The Vite development server
proxies `/api` to `http://localhost:5000`; start the backend separately. `vite
preview` proxies `/api` to the end-to-end API on port 5099 instead, which is how
the Playwright suite in `e2e/` runs the production build.

### Lockfiles

CI installs with the npm that ships with Node 22 (npm 10). npm 11 prunes lock entries that
npm 10 still requires, so a lockfile written by npm 11 fails `npm ci` on CI with
"Missing: <package> from lock file". After changing dependencies, regenerate the lockfile
with npm 10:

```sh
npx npm@10 install --package-lock-only
```

Then check both: `npx npm@10 ci --dry-run` and `npm ci --dry-run`.

### Updating dependencies

CI's `audit` job is **required** (since Phase 3): `npm audit --omit=dev --audit-level=high`
must find nothing in `backend/` and `frontend/`. To fix an advisory, take the **newest release
that is at least two weeks old** and fixes it (freshly published versions carry the most
supply-chain risk), with npm 10 so the lockfile stays readable by CI:

```sh
npx npm@10 install <package>@<version> --before=<date two weeks ago>
npx npm@10 audit fix --before=<date two weeks ago>      # transitive fixes, no major bumps
npx npm@10 ci --dry-run && npm ci --dry-run              # both npm versions accept the lock
```

`--before` makes npm resolve every package, direct and transitive, as the registry stood on
that date. If you raise a patched minimum, update `tests/unit/dependencyFloors.test.js` (backend)
or `test/unit/dependencyFloors.test.js` (frontend) too.

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

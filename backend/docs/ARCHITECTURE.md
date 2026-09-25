# SignPak Commons Backend Architecture

## Runtime

The backend is an Express application running on Node.js 20+ with MongoDB through Mongoose. `server.js` owns process startup, environment validation, database connection, admin bootstrap, and the listening port. `src/app.js` builds and exports the HTTP application so integration tests can exercise the same middleware and routes without opening a port.

## Request flow

```text
HTTP request
	-> app middleware (logging, security headers, CORS, compression, parsing)
	-> API prefix middleware (rate limit, origin verification)
	-> route guards (authentication, role checks, validation, upload parsing)
	-> controller
	-> service
	-> repository
	-> Mongoose model
	-> MongoDB
```

The dependency direction is one way: controllers do not query models, services do not read `req` or write `res`, and repositories do not contain business rules.

## Responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Application | `src/app.js` | Compose global middleware, API routes, and error handling. |
| Routes | `src/routes/` | Map HTTP methods and paths to guards and controllers. Swagger UI is exposed at `/api/v1/docs`. |
| Middleware | `src/middlewares/` | Authentication, roles, validation, uploads, rate limits, origin checks, and errors. |
| Controllers | `src/controllers/` | Translate HTTP input to a service call and return the standard response envelope. |
| Services | `src/services/` | Enforce domain rules, coordinate repositories, and manage stored files. |
| Repositories | `src/repositories/` | Encapsulate MongoDB queries and persistence operations. |
| Models | `src/models/` | Define Mongoose schemas, indexes, and public JSON serialization. |
| Storage | `src/services/storage/` | Hide file storage behind save, stat, stream, and remove operations. |
| Configuration | `src/config/` | Validate environment variables, database state, and shared constants. |
| Documentation | `src/docs/`, `docs/` | Maintain the OpenAPI contract and human-readable system documentation. |

## API boundary

All application endpoints are mounted below `/api/v1`. Successful JSON responses use `{ "data": value }`; validation and application failures use `{ "error": { ... } }`. Mutating requests with an `Origin` header must come from a configured client origin. Every request receives an `X-Request-Id` for support and log correlation.

The authentication token is stored in the `httpOnly` `signpak_token` cookie. The server reloads the user from MongoDB on authenticated requests, so role and account changes take effect without waiting for a token refresh. See [API.md](./API.md) for the endpoint contract and `/api/v1/docs` for the interactive OpenAPI reference.

## Data and media

MongoDB stores users, categories, videos, submissions, cooldown records, and contact messages. Video and recording bytes are stored through the storage driver; MongoDB stores a driver reference, key, MIME type, and size rather than file contents.

Published videos assigned to a category are visible to anonymous visitors. Their metadata, posters, and reference files can be read by the public demo and library. Draft or unassigned videos remain restricted to admins. Contributor recordings are never publicly playable; only admins can access a submission recording.

Uploads are first written to a temporary directory, checked by file signatures, and moved into storage only after validation. Failure cleanup removes temporary and already-stored files where necessary.

## Security controls

- Helmet security headers and disabled `x-powered-by`.
- CORS with an explicit client-origin allowlist and credentials enabled.
- SameSite HTTP-only JWT cookies plus origin verification for state-changing requests.
- Global and operation-specific rate limits.
- Zod validation for JSON, multipart fields, route IDs, and query parameters.
- Role checks for admin routes and submission recording playback.
- File type sniffing instead of trusting browser-provided MIME types.

## Testing and extension points

`npm test` runs the HTTP integration suite. The storage driver contract is the extension point for adding a remote provider such as Google Drive. The OpenAPI definition in `src/docs/openapi.js` should be updated whenever a public route, request shape, response shape, or security rule changes.

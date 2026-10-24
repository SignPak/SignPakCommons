# Backend architecture decisions

This is a record of current choices and their trade-offs, not a dated changelog.

## Keep HTTP, domain, and persistence responsibilities separate

**Decision:** Express routes compose middleware; controllers adapt HTTP inputs
and responses; services enforce domain rules; repositories encapsulate
MongoDB queries.

**Reason and trade-off:** The same business behavior can be tested without an
HTTP request, and API response formatting stays at the boundary. New features
must be threaded through several layers rather than placing all logic in a
route handler.

**Implementation:** `src/routes/`, `src/controllers/`, `src/services/`, and
`src/repositories/`.

## Store media bytes outside MongoDB

**Decision:** MongoDB stores metadata and opaque `{ driver, key }` file
references. Local and Google Drive drivers provide file storage and streaming.
Reference-video URLs may also be direct HTTPS media URLs; those URLs are stored
as video metadata while their poster remains a stored file.

**Reason and trade-off:** Database documents remain small and storage can be
switched or separated by intent. External URLs avoid copying video bytes but
depend on the remote host's availability and browser media/CORS behavior.

**Implementation:** `src/models/Video.js`, `src/models/storedFile.js`,
`src/services/storage/`, and `src/services/videoService.js`.

## Preserve byte-range media streaming

**Decision:** Stored video endpoints support HTTP Range requests; the storage
driver exposes streams for requested byte ranges.

**Reason and trade-off:** Browsers use range access for seeking and native
playback. Storage drivers must preserve inclusive range semantics, MIME type,
and file size.

**Implementation:** `src/utils/sendFile.js` and
`src/services/storage/`.

## Treat contributor submissions as append-only records

**Decision:** Accepted submission records and archived recording bytes are
retained when an account or base video is deleted. A separate contact request
allows the team to review recording/data deletion.

**Reason and trade-off:** Contribution history and released model provenance
remain stable. This increases responsibility for retention and requires an
explicit process for deletion requests.

**Implementation:** `src/services/submissionService.js`,
`src/services/userService.js`, and `src/services/contactService.js`.

## Make external integrations optional and failure-tolerant where safe

**Decision:** Local file storage works without Google Drive; Redis caching is
optional; transient cache failures fall back to authoritative reads. Cache
values have explicit expirations and do not contain poster image bytes.

**Reason and trade-off:** Local development and core reads do not require every
provider to be configured. Cache outages can increase storage/database work,
but should not make cached data appear authoritative.

**Implementation:** `src/config/env.js`, `src/services/cache/upstashRedis.js`,
`src/services/publicStatsService.js`, and `src/services/videoService.js`.

## Put access and validation at the server boundary

**Decision:** Route guards, authentication, Zod validation, role checks, file
signature checks, rate limits, and origin checks are enforced server-side.
Client-side restrictions improve UX but are not security controls.

**Reason and trade-off:** API callers are not limited to the first-party UI.
Routes and services must retain visibility checks even when the client already
filters data.

**Implementation:** `src/routes/`, `src/middlewares/`, and `src/services/`.

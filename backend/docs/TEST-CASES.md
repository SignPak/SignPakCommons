# Backend test cases

The backend suite uses Node's built-in test runner. It currently contains **56 test
cases** across twelve test files. Each named API test suite has its own `.test.js`
file and starts with a fresh test database and account fixtures:

| Test file | Cases | Main test type |
| --- | ---: | --- |
| `tests/api-basics.test.js` | 4 | HTTP integration tests |
| `tests/api-demo-video.test.js` | 1 | HTTP integration tests |
| `tests/api-auth.test.js` | 8 | HTTP integration tests |
| `tests/api-profile-connections.test.js` | 1 | HTTP integration tests |
| `tests/api-categories.test.js` | 2 | HTTP integration tests |
| `tests/api-videos.test.js` | 6 | HTTP integration tests |
| `tests/api-submissions.test.js` | 8 | HTTP integration tests |
| `tests/api-admin-stats-contact.test.js` | 4 | HTTP integration tests |
| `tests/api-admin-user-controls.test.js` | 4 | HTTP integration tests |
| `tests/safeName.test.js` | 3 | Unit tests |
| `tests/localStorage.test.js` | 6 | Filesystem/storage integration tests |
| `tests/videoService.test.js` | 9 | Unit tests |

## Test types

- **HTTP integration** exercises the Express app through HTTP requests and checks
  interactions between routing, middleware, services, MongoDB, and local storage.
  The suite uses MongoDB Memory Server by default. Email and contact-delivery
  providers are stubbed.
- **Unit** checks a focused function or service rule, with external dependencies
  stubbed where needed.
- **Filesystem/storage integration** exercises the local storage driver or storage
  service against temporary directories and real files.

## API suite files — HTTP integration tests

Each API suite file uses `tests/apiContext.js` to start the app with a fresh test
database, create representative admin and contributor accounts, and clean up the
database and server afterward. The suite-specific fixtures are initialized within
their respective test file. Each API case below is an HTTP integration test.

### `tests/api-basics.test.js` — Basics

1. **root advertises the API and favicon is ignored** — Checks the root response,
   favicon handling, both documentation UI routes, and both OpenAPI JSON routes.
2. **health check reports the database** — Checks that the health endpoint reports
   a connected database.
3. **unknown routes and bad JSON use the error shape** — Checks 404 handling and
   malformed JSON handling, including their standard error codes.
4. **cross-origin writes are refused, allowed origin passes** — Checks that a
   disallowed request origin is rejected while the configured client origin can
   perform a write.

### `tests/api-demo-video.test.js` — Demo video

5. **admins can upload, replace, and delete the public demo video** — Checks public
   empty and file responses, admin-only upload, replacement and cleanup, and that
   the demo video is separate from the regular video library.

### `tests/api-auth.test.js` — Authentication

6. **signup validates every field** — Checks required signup fields, password
   confirmation, and minimum password length.
7. **signup sets an httpOnly cookie and never leaks the hash or accepts a role** —
   Checks that signup does not create a session before verification, ignores a
   submitted admin role, verifies email, sets secure cookie attributes, and does
   not expose the password hash.
8. **password reset codes are one-time and replace the old password** — Checks the
   generic reset-request response, invalid-code handling, password replacement,
   code reuse rejection, and invalidation of the old session.
9. **duplicate emails conflict, case-insensitively** — Checks that signup rejects
   an address that already exists with different letter casing.
10. **login: wrong password and unknown email give the same answer** — Checks
    equivalent unauthorized responses for an unknown account and a wrong
    password.
11. **session, logout and tampered cookies** — Checks anonymous and authenticated
    session responses, logout, and rejection of an invalid session cookie.
12. **the env admin exists once, has the admin role, and re-running is harmless**
    — Checks environment-admin bootstrap is idempotent and assigns the admin role.
13. **admin-only routes reject contributors and visitors** — Checks role and
    authentication enforcement on an admin endpoint.

### `tests/api-profile-connections.test.js` — Profile connections

14. **normalises, validates, and disconnects** — Checks GitHub and LinkedIn URL
    normalization, invalid-handle validation, clearing one connection without
    changing the other, and authentication requirements.

### `tests/api-categories.test.js` — Categories

15. **only admins write; names are unique regardless of case** — Checks role
    access, category creation, case-insensitive uniqueness, and invalid tone
    validation.
16. **update and public listing** — Checks category updates, duplicate-name and
    empty-update validation, public listing, and invalid ID validation.

### `tests/api-videos.test.js` — Videos

17. **upload needs a real video file** — Checks missing, fake, and invalid-category
    uploads, admin access, and cleanup of rejected temporary uploads.
18. **admin uploads with and without a poster; the API hides storage internals** —
    Checks upload responses and defaults, ordering, optional posters, public
    resource URLs, storage metadata privacy, and stored-file counts.
19. **visibility: contributors and visitors only see published, categorised
    videos** — Checks that admins can see all videos while contributors and
    visitors only see published videos assigned to a category.
20. **published files stream publicly with Range support** — Checks full and
    partial video responses, suffix ranges, unsatisfiable ranges, content types,
    and hidden draft files.
21. **posters are served as images** — Checks public poster delivery and the
    missing-poster response.
22. **editing: moving categories appends to the end of that path** — Checks video
    movement and ordering, invalid category/status handling, draft updates, and
    admin-only editing.

### `tests/api-submissions.test.js` — Submissions and cooldown

23. **archive and database failures release cooldown and remove any archived
    file** — Checks rollback and cleanup when archive storage or database creation
    fails after the cooldown is claimed.
24. **input is checked before anything is stored** — Checks authentication,
    required and valid recording content, trim ranges, video IDs and visibility,
    plus absence of orphaned files on rejection.
25. **a valid submission is stored and listed** — Checks successful submission
    metadata, recording privacy, archive storage, contributor ownership, and
    admin visibility.
26. **COOLDOWN: a second submission for the same video, too soon, is refused and
    stores nothing** — Checks cooldown rejection and temporary/archive file
    cleanup.
27. **COOLDOWN: concurrent double-submits for the same video produce exactly one
    submission** — Checks atomic cooldown behavior under concurrent uploads and
    cleanup of losing uploads.
28. **COOLDOWN: once it elapses, the same video can be submitted again, as a new,
    separate recording** — Checks that a later submission succeeds as a distinct
    append-only record after the cooldown expires.
29. **a submission can never be edited, deleted, or read once archived** — Checks
    that submission mutation and recording playback endpoints remain unavailable
    to contributors and admins.
30. **deleting a base video keeps contributors' submissions on record** — Checks
    that deleting the reference video removes its file and record without
    removing archived submissions.

### `tests/api-admin-stats-contact.test.js` — Admin stats and contact

31. **stats add up** — Checks admin access, aggregate totals, daily activity,
    category counts, recent submissions, handling of deleted videos, and the
    allowed day range.
32. **deleting a category unassigns its videos instead of deleting them** —
    Checks that category deletion keeps videos but makes unassigned videos
    invisible to contributors.
33. **contact delivery requires matching account email, enforces quotas, and
    blocks abusive devices** — Checks contact validation, delivery failure
    handling, matching account email, per-user and global daily quotas, anonymous
    access rejection, device blocking, message listing, and admin-only access.
34. **oversized uploads are rejected with 413** — Checks payload-too-large
    responses and temporary-file cleanup.

### `tests/api-admin-user-controls.test.js` — Admin user controls and access restrictions

35. **suspending a user blocks its existing session and login; reactivation
    restores access** — Checks self-suspension protection, suspension effects on
    sessions and login, and reactivation.
36. **deleting a user removes their submissions, cooldowns, and stored
    recording** — Checks account deletion cleanup across database records,
    cooldowns, archive storage, sessions, and admin listings.
37. **device restrictions reject matching IDs, expose only a hint, and can be
    removed** — Checks device restriction creation, hashed-identifier privacy,
    blocking, duplicate detection, and removal.
38. **IP restrictions block API traffic while admin routes remain available for
    recovery** — Checks IP validation and restriction enforcement while
    preserving admin access to remove restrictions.

## Utility, storage, and video-service test files

These tests call functions and services directly rather than exercising HTTP
routes. The cases are separated by the behavior under test.

### `tests/safeName.test.js` — Safe names (unit tests)

39. **safeName uses its fallback for nullish and blank values** — Checks fallback
    behavior for nullish, whitespace-only, and fully sanitized names.
40. **safeName replaces reserved path characters and collapses whitespace** —
    Checks removal of path-reserved characters, whitespace normalization, and
    string conversion of non-string values.
41. **safeName caps its output at 100 characters** — Checks the maximum safe-name
    length.

### `tests/localStorage.test.js` — Local driver and storage service (filesystem/storage integration tests)

42. **local driver stores named files in folders and appends suffixes on
    collisions** — Checks directory placement, readable keys, collision naming,
    and file contents.
43. **local driver handles named files without an extension and dotfiles** —
    Checks collision naming for extensionless names and dotfiles.
44. **local driver generates unique UUID keys when no file name is supplied** —
    Checks generated key format and uniqueness.
45. **local driver rejects paths escaping the storage root and keeps the source
    file** — Checks rejection of traversal through file names or folder names and
    confirms rejected saves do not consume the source file.
46. **local driver stat reports missing files and remove is idempotent** — Checks
    missing-file errors from stat and harmless removal of an absent key.
47. **storageService forwards named folder and file name to the local driver** —
    Checks storage-service metadata, destination key, file size, and cleanup.

### `tests/videoService.test.js` — Video service (unit tests)

48. **video create names video and poster from title and category safely** —
    Checks sanitized names, category folder selection, poster naming, storage
    calls, and category ordering.
49. **video create uses Unassigned and Untitled fallbacks when optional labels
    are absent** — Checks fallback folder and file names, default ordering, and
    absent poster metadata.
50. **video create selects detected video and image extensions** — Checks
    content-detected extensions for WebM, MOV, PNG, and WebP rather than relying
    on the original file name.
51. **video create rejects a missing upload, unsupported content, and invalid
    categories before storage** — Checks validation errors and confirms storage is
    not called for invalid input.
52. **video create rejects oversized or unsupported posters before storage** —
    Checks poster size and real-content validation before any storage call.
53. **video create accepts a poster exactly at the size limit** — Checks that a
    poster at the configured maximum size is accepted.
54. **video create surfaces filesystem errors instead of reporting invalid video
    content** — Checks missing-file I/O errors are preserved and storage is not
    called.
55. **video create removes already stored files when poster storage fails** —
    Checks cleanup of the stored video when the subsequent poster save fails.
56. **video create removes video and poster if the database write fails** —
    Checks cleanup of both stored files when database record creation fails.

## Running the suite

From `backend/`, run:

```bash
npm test
```

This executes `node --test --test-concurrency=1` across all `.test.js` files.

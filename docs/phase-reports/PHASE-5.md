# Phase 5 – Admin tools for deletion requests and messages (C3)

## Phase and branch

| | |
| --- | --- |
| Phase | 5 – Admin tools for deletion requests and messages (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-5-admin-deletion-tools` (from `main` @ `3423a45`, Phase 4 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.10 → 1.0.11`, frontend `1.0.12 → 1.0.13` |

## Checklist items

| Item | Status | Summary |
| --- | --- | --- |
| C3 | **Fixed, ticked** | An admin can delete one contributor's recordings: the storage files and the Submission documents, on their own or together with the account. Every deletion is recorded. Admin → Messages takes a deletion request to "0 recordings left", proven in E2E on all three engines. |
| FR13.13 | **Works** | User side in Phase 4, admin side now. The checklist's FR13 table says so. |
| "No admin page for contact messages" (leftovers) | **Ticked** | Admin → Messages. |

## Claims checked against the code first

- **C3: confirmed.**
  - No route deleted submissions.
  - `userService.remove` and `removeSelf` deleted only the User and its cooldowns, so the
    Submission documents and the archived recording files stayed.
  - `GET /admin/messages` existed, but nothing in the frontend called it.
- The old header comment on `submissionService` said a submission can never be deleted. It now
  names the one deletion path, as the backend guide asks for any change to retention.

## Decision taken during planning

**The email hash is HMAC-SHA-256 with a new secret, `EMAIL_HASH_SECRET`**, not the plain
SHA-256 FIX-PLAN mentions (your choice). A plain hash of an email can be reversed by hashing a
list of likely addresses.
- It's separate from `JWT_SECRET`, so rotating the login secret never breaks matching.
- **Production refuses to start without it** (at least 32 characters). Outside production an
  empty value falls back to a fixed development key.
- `setup.md` and both env templates say to generate it once (`openssl rand -hex 32`), back it
  up, and never change it.
- **Action before the next deploy:** add `EMAIL_HASH_SECRET` to the server's `.env`.

## Routes, models and env vars

**Routes** (admin only, behind the existing `authenticate` + `requireRole(ADMIN)`; none
renamed; documented in `docs/API.md` and `src/docs/openapi.js`):

| Route | What it does |
| --- | --- |
| `GET /admin/users/:id/submissions?limit=&cursor=` | One page, newest first: `{ items, total, nextCursor }`. Works for a deleted account's id. |
| `DELETE /admin/users/:id/submissions?requestMessageId=` | Deletes all of the contributor's recordings and returns `{ deleted, failed: [{ id, reason }] }`. 404 only when there are no submissions and no account or deleted-account record. |
| `DELETE /admin/users/:id?withRecordings=true` | The existing route; the flag deletes the recordings first, and answers **409 and keeps the account** if any file fails. |
| `GET /admin/messages?topic=&status=&verified=&limit=` | The existing route, with filters. |
| `PATCH /admin/messages/:id { status }` | `done`/`rejected` record `handledAt`/`handledBy`; `open` clears them. |
| `GET /admin/deletion-lookup?messageId=` or `?email=` | Exactly one of the two. Returns `{ matches }`: the current account and any deleted account that used the email, each with `submissionCount`. |

**Models**
- `DeletionLog` (new, append-only): `userId`, `emailHash`, `deleted`, `failed`,
  `accountDeleted`, `requestMessageId`, `adminId`, `at`. It never holds the email.
- `DeletedAccount` (new): `userId`, `emailHash`, `by` (`self` | `admin`), `deletedAt`.
  - It's written on **every** account deletion, by an admin or by the contributor, because
    account deletion keeps the recordings. A later deletion request is matched through it.

**Env:** `EMAIL_HASH_SECRET`, in `env.js`, both templates and `setup.md`.

## Files changed

**Backend**
- `src/services/submissionService.js`: `removeAllForUser` and `pageForUser`.
- `src/services/userService.js`: `withRecordings`; a `DeletedAccount` on admin and self
  deletion.
- `src/services/contactService.js`: `list(filters)` and `setStatus`.
- `src/services/deletionLookupService.js` (new).
- `src/models/DeletionLog.js`, `src/models/DeletedAccount.js`,
  `src/repositories/deletionRepo.js` (new).
- `src/repositories/submissionRepo.js`: `allForUser`, `countForUser`, `removeMany`,
  `pageForUser`. `src/repositories/messageRepo.js`: filtered `list` and `findById`.
- `src/utils/emailHash.js` (new).
- `src/utils/requestLog.js` and `src/app.js`: `requestLogSerializer` redacts `email=` from
  logged URLs.
- `src/routes/adminRoutes.js`, `src/middlewares/validators/adminSchemas.js`, and the admin,
  contact and user controllers.
- `src/config/env.js`, `.env.example`, `.env.production.example`.
- Docs: `docs/API.md` (including an "Acting on a deletion request" section),
  `src/docs/openapi.js`, `docs/ARCHITECTURE.md`, `docs/MODULE-REFERENCE.md`, `docs/setup.md`,
  `README.md`.

**Frontend**
- `src/pages/admin/AdminMessages.jsx` (new):
  - filters for topic, status and verified;
  - a Verified / Unverified / **Manual check** badge (an unverified request whose lookup finds
    no current account);
  - Find contributor → Delete recordings (the confirmation names the count) → Mark done,
    Reject or Reopen.
- `src/pages/admin/AdminUsers.jsx`: **Delete recordings** and **Delete account and
  recordings**. Every confirmation names the number of recordings, and the plain **Delete**
  text still says they are kept.
- `src/pages/admin/AdminLayout.jsx` (a Messages tab), `src/App.jsx`, `src/routes/appRoutes.js`,
  `src/services/api.js` and `apiRoutes.js` (`api.admin.*`,
  `users.remove(id, { withRecordings })`).
- Styles: `components.css` (`badge-danger`, which `AdminUsers` already used without a style,
  and `badge-warning`), `admin.css`.
- `src/components/ContactForm.jsx`: see "Found during the phase".
- Docs: `README.md`, `docs/architecture.md`, `docs/MODULE-REFERENCE.md`.

The consent and policy text and `CONSENT_VERSION` are **unchanged** (FIX-PLAN item 3).
Account deletion alone still keeps recordings, and recordings are removed on request.

## Tests added

| Level | File | Cases | Rows |
| --- | --- | ---: | --- |
| Unit (backend) | `emailHash.test.js`: normalized, per-address, keyed (not plain SHA-256), refuses empty input | 4 | U-124–U-127 |
| Unit (backend) | `removeAllForUser.test.js`: all removed; **keeps going after a failed file and keeps its document**; log with counts and hash, never the email; the hash from `DeletedAccount` when the account is gone; 404; `accountDeleted` | 6 | U-128–U-133 |
| Unit (backend) | `adminDeletionSchemas.test.js` | 4 | U-134–U-137 |
| Unit (backend) | `env-guards.test.js`: production refuses a missing, empty or short secret; development falls back | +2 | U-138, U-139 |
| Unit (backend) | `requestLog.test.js`: `email=` redacted from the logged URL | +1 | U-140 |
| Integration | `api-admin-deletion.test.js` (fake Google Drive) | 13 | I-73–I-85 |
| Security | `admin-deletion.test.js`: no deletion record contains the email in any field; query operators refused (422) on the lookup, cursor, filters and `requestMessageId` | 2 | S-18, S-19 |
| Security | `access-matrix.test.js`: the 4 new routes; anonymous 401, contributor 403, suspended 401 | +4 | S-01 |
| Unit (frontend) | `AdminUsers.test.jsx`: count in the confirmation, cancel, `withRecordings`, plain delete keeps recordings, partial failure | 5 | FU-29–FU-33 |
| Unit (frontend) | `ContactForm.test.jsx`: fields disabled until the session is known | +1 | FU-34 |
| Integration (frontend) | `AdminMessages.test.jsx` (MSW): badges; filters reach the API; find → delete with the confirmed count → mark done; manual check; partial failure | 5 | FI-17–FI-21 |
| E2E | `admin-deletion.spec.js`: "C3: a deletion request ends with 0 recordings left for that contributor" | 1 × 3 browsers | E-07 |

The 13 integration tests run on the fake Drive driver:
- removal from Drive **and** MongoDB, with a `DeletionLog` that holds no email;
- a partial failure, then a retry that finishes;
- `withRecordings=true`, and the 409 that keeps the account when a file fails;
- plain admin deletion keeps the recordings and records the account; self-deletion is
  recorded too;
- the lookup finds a deleted account by email and by message id, and finds both kinds after
  a re-signup;
- pagination with no duplicates;
- message filters, and status changes with `handledAt`/`handledBy`.

**How the E2E test works:**
1. An admin API session creates two reference videos.
2. A contributor signs up through the UI and uploads two recordings from their own browser
   session. The file is a minimal WebM, so no camera is needed; the recording UI has its own
   tests. The profile shows 2.
3. The contributor sends a deletion request, signed in.
4. An admin, in a second browser context, opens Messages, filters to deletion requests, sees
   "Verified", clicks Find contributor ("2 recordings"), accepts the confirmation, sees
   "Deleted 2 recordings" and clicks Mark done.
5. The contributor's profile now shows 0.

**Production test fixtures.** Five fixtures that build a valid production configuration now
also set `EMAIL_HASH_SECRET`, because production requires it: `productionApp.js`,
`listen-address`, `deployConfig`, `env-guards`, `listenHost`. No assertion changed.

**Proof**
- With `src/` stashed back to main, **14 of the 15** new integration and security tests fail.
  The one that passes is "an unknown contributor id gives 404", because main has no such route
  at all.
- The new ContactForm test fails with the fix removed.

## Found during the phase

**Contact form: input could be lost while the session loaded.** The new E2E test failed on
WebKit.
- **What happened:** the landing page first shows the signed-out form while it checks the
  session (Phase 4). The test chose a topic there. When the session arrived, the form
  re-mounted as the signed-in form and the choice was gone. A real user typing in that moment
  would lose the text the same way.
- **Fix:** every field, not just the send button, is disabled until the session is known.
- **Test:** FU-34 fails without the fix.
- The E2E test also waits for the signed-in form, as the Phase 4 contact test does.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 21 Nov 2026. Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 140, pass 140, fail 0 | 0 |
| backend `test:integration` | tests 85, pass 85, fail 0 | 0 |
| backend `test:security` | tests 71, pass 71, fail 0 | 0 |
| backend `test:coverage` | pass 296, fail 0; overall 93.46% lines / 88.99% branches; "Coverage gate passed." | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 14 passed (14), Tests 60 passed (60) | 0 |
| frontend `test:coverage` | Lines 29.08% (was 24.62%); thresholds passed | 0 |
| frontend `build` | built; main chunk 539.09 kB (gzip 164.68 kB), was 530.68 kB | 0 |
| `e2e` | **21 passed** (1.3 m): 7 tests × Chromium, Firefox, WebKit | 0 |
| `npm audit --omit=dev --audit-level=high` (backend, frontend, e2e) | found 0 vulnerabilities ×3 | 0 |

### Coverage

| Scope | Phase 4 | Phase 5 | Floor |
| --- | --- | --- | --- |
| Backend overall | 92.92% lines / 88.2% branches | **93.46% / 88.99%** | 85 / 75 |
| `src/services` | 87.42% / 86.68% | **88.37% / 87.54%** | 80 / 75 |
| `src/middlewares` | 97.94% / 87.41% | 98.14% / 87.59% | 80 / 75 |
| `src/utils` | 99.4% / 92.45% | 99.44% / 92.77% | 80 / 75 |
| Frontend overall | 24.62% lines | **29.08%** | 18 |

### CI

Filled in below once the PR's run finishes.

## How to verify by hand

```sh
git switch fix/phase-5-admin-deletion-tools
cd backend  && npm ci && npm test && npm run test:coverage
cd ../frontend && npm ci && npm test && npm run build
cd ../e2e && npm ci && npm run e2e
# Watch the deletion flow:
npx playwright test tests/admin-deletion.spec.js --headed --project=chromium
```

In the running app as an admin:
1. **Admin → Messages:** filter to deletion requests, then Find contributor. Delete recordings
   asks you to confirm the number, and Mark done closes the request.
2. **Admin → Users:** Delete recordings or Delete account and recordings. Each confirmation
   names the number of recordings.

## Not done, and deviations from the plan

1. **A file that can't be deleted keeps its Submission document.** FIX-PLAN says to delete the
   documents. Keeping the document means the pointer to the orphaned Drive file is never lost:
   calling the route again finishes the job, and the response lists what failed.
2. **Delete account and recordings stops (409) if any file fails,** rather than deleting the
   account with recordings still in storage.
3. **The email hash is keyed (HMAC), not plain SHA-256** (your planning choice).
4. **The lookup also accepts `messageId`**, and the admin page uses it, so an email never
   appears in a URL or the Nginx log. `?email=` works as FIX-PLAN describes, and the API's own
   request log redacts it.
5. **There's no admin view of `DeletionLog` yet.** The records are written and tested; Phase 7's
   activity log is where admin actions become visible.
6. **Confirmations use `window.confirm`,** as `AdminUsers.jsx` already did, rather than a new
   dialog component.

## Known risks

1. **`EMAIL_HASH_SECRET` must never change** once deletions are recorded. Production won't
   start without it, so the server's `.env` needs it before the next deploy.
2. **Deleted recordings are gone for good.** Drive deletion through the API skips the bin. The
   confirmations say "can't be undone".
3. **Recordings are deleted one at a time.** For one contributor (tens of files) that takes a
   few seconds on Drive. A contributor with thousands of recordings could approach the
   proxy's 300 s timeout. If the request times out, calling it again finishes the job.
4. **A deleted account's hash is matched exactly.** If someone asks from a different address
   than the one they used, the lookup finds nothing and the badge says "Manual check", which
   is the intended route for the team.

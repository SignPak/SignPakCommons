# Phase 7 – Admins and activity log (S7, D5)

## Phase and branch

| | |
| --- | --- |
| Phase | 7 – Admins and activity log (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-7-admins-audit-log` (from `main` @ `3ea5649`, Phase 6 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.12 → 1.0.13`, frontend `1.0.14 → 1.0.15` |

## Checklist items

| Item | Status | Summary |
| --- | --- | --- |
| S7 | **Fixed, ticked** | Separate admin accounts from `ADMIN_EMAIL` + `ADMIN_EMAILS`, synced at startup; every admin action in an activity log; Admin → Activity. |
| FIX-PLAN Phase 7 item 4 | Done | Login attempts logged at `info` with the email hash, the outcome and the IP. |
| FIX-PLAN Phase 7 item 5 (from Phase 5 verification) | **Fixed, marked done in FIX-PLAN** | `DeletionLog.accountDeleted` is only `true` once the account has really been deleted. |

## Claims checked against the code first

All confirmed:
- **S7:** `authService.ensureAdminFromEnv` only knew `ADMIN_EMAIL`. Nothing recorded which
  admin did what; `DeletionLog` covered recording deletions only.
- **Item 5:** `submissionService.removeAllForUser` wrote the `DeletionLog` with
  `accountDeleted: accountDeletion && failed.length === 0`, before `userService.remove` ran
  `deleteAccount()`. The new integration test (I-125) failed on `main`: the log said `true`
  while the account still existed.
- **Sessions:** `authenticate` re-reads the user on every request, so a role change applies to
  open sessions at once. Nothing has to end sessions on demotion.

## What changed

### 1. Separate admin accounts (D5)
- **`ADMIN_EMAILS`** (optional, comma-separated) is parsed in `env.js`: trimmed, lowercased,
  de-duplicated, each entry must be an email (the server refuses to start otherwise).
  `env.adminEmails` is `ADMIN_EMAIL` plus that list. Added to both env templates and `setup.md`.
- **`authService.syncAdmins()`** runs at the end of `ensureAdminFromEnv()`, so on every start:
  - every **verified** `user` account on the list becomes an admin (an unfinished sign-up is
    skipped until it's finished);
  - every admin **not** on the list goes back to `user`, one at a time, and the one that would
    leave no active admin is kept, with a `warn` log. `ADMIN_EMAIL` is always on the list, so
    that is a safety net;
  - each change is logged and written to the activity log as `admin.promote` /
    `admin.demote`, by "System".
- `userRepo` gained `findByEmails` and `listAdmins`.
- `setup.md` has the steps: the team member signs up, their email goes in `ADMIN_EMAILS`, then
  `pm2 reload deploy/ecosystem.config.cjs`. The README says the same.

### 2. The activity log
- **`AuditLog` model**: `actorId` (null = system), `action` (enum `AUDIT_ACTIONS` in
  `constants.js`), `targetType`, `targetId`, `meta`, `at`; indexed on `at` and on
  `actorId + at`. Append-only (`auditRepo` has `create` and `list` only).
  `bufferCommands` is off, so a write without a database connection fails at once and is
  logged, instead of waiting.
- **`auditService.record()`** is called by the **services** after the action has succeeded,
  never by the controllers. `sanitizeMeta` keeps at most 10 plain values (strings cut to 200
  characters) and drops any key that looks like a password, token, secret, hash, code, email,
  cookie or OTP. A failed write is logged at `error` and does not fail the request.
- **Recorded actions:** video create/update/delete; category create/update/delete; demo
  upload/delete; user suspend/reactivate/delete; recordings deleted; restriction create/remove;
  message status changed; admin promoted/demoted at startup. To do that, the category, demo,
  video update/remove and restriction services now receive the acting admin from the
  controller. No route changed.
  - A restriction entry keeps only the type and the hint (`198.51.100.x`), never the IP or
    device id.
  - `DELETE /admin/users/:id?withRecordings=true` writes two entries, `recordings.delete`
    then `user.delete`: they are two actions.
  - A refused action (404, 409, 422) writes nothing.
- **`GET /admin/audit`** (admin only): `?page`, `?limit` (1–100, default 50), `?actor` (an admin
  id or `system`), `?action`. Answers `{ data: { entries, page, limit, total } }`, newest first.
  Each entry has `actor: { id, name }`, with the name looked up when the log is read ("System",
  or "Deleted account" for an admin deleted since).
- **Admin → Activity** (`/admin/activity`, a new tab): a table of when, admin, action
  (readable label), target and details; filters for admin (the current admins plus System)
  and action; Previous/Next, 25 a page. The query is checked with Zod in the API client before
  it is sent (`src/utils/auditLog.js`).

### 3. Login attempts in the server log (item 4)
`authService.login(credentials, { ip })` writes one `info` line per attempt:
`{ event: 'login', emailHash, outcome, ip }`, where `outcome` is `success`,
`wrong-password`, `unknown-email`, `locked`, `suspended` or `unverified`. The hash is the
keyed `hashEmail` (`EMAIL_HASH_SECRET`). Never the password, never the email.

### 4. `DeletionLog.accountDeleted` (item 5)
- `removeAllForUser` always writes the log with `accountDeleted: false`. Its answer is still
  `{ deleted, failed }`; a new `submissionService.removeRecordings()` returns the log too.
- `userService.remove(..., { withRecordings: true })` calls `deleteAccount()` first, and only
  then `deletionLogRepo.markAccountDeleted(log._id)`. If that last update fails, the account
  is gone anyway, so it is logged rather than turned into an error.
- The model and repository comments and `docs/API.md` now say "append-only, except that
  `accountDeleted` is set once the account is gone".

## Tests

Each new test is named with its ID. The backend tests were written first and run against the
unchanged code: `adminSync` and `auditService` failed to load (the modules didn't exist),
`loginLog` 4 of 4 failed, the three `ADMIN_EMAILS` env tests failed, `api-admin-audit` 14 of
14 failed, the item 5 test failed (log `true`, account still there), and the access-matrix row
failed (no route). The Activity page and the E2E test need the new page and route, so they
cannot pass on `main` either.

| Level | File | Tests | Rows |
| --- | --- | --- | --- |
| Unit | `adminSync.test.js` (new) | listed verified accounts promoted, unverified not; unlisted admins demoted; `ADMIN_EMAIL` never demoted; the last active admin never demoted; a suspended unlisted admin demoted; one system audit entry per change; nothing changes when already in sync | U-162–U-168 |
| Unit | `auditService.test.js` (new) | unsafe keys dropped; only plain values, cut and capped; the written entry; a failed write logged and not thrown | U-169–U-172 |
| Unit | `loginLog.test.js` (new) | success, wrong password, unknown email, locked/suspended/unverified each logged with the hash, outcome and IP, never the password or email | U-173–U-176 |
| Unit | `env-guards.test.js` (extended) | `ADMIN_EMAILS` optional; split/trim/lowercase/de-duplicate; an invalid entry stops the server | U-177–U-179 |
| Unit | `accountDeletionLog.test.js` (new) | item 5: marked only after the account is deleted; never marked when the deletion fails; no log for a plain deletion | U-180–U-182 |
| Integration | `api-admin-audit.test.js` (new) | each action through HTTP writes exactly one entry with the right admin, action and target (8 tests, `withRecordings` gives two); a refused action writes nothing; the startup sync promotes, the new admin acts under her own name, then is demoted; paging; filters by admin, system and action; 422 on bad filters; "Deleted account"; no email in any entry | I-111–I-124 |
| Integration | `api-admin-deletion.test.js` (extended) | item 5: `withRecordings=true` with the account deletion failing → 500, the recordings are gone, `DeletionLog.accountDeleted` is `false`, and the account still exists | I-125 |
| Security | `access-matrix.test.js` | `GET /api/v1/admin/audit`: anonymous 401, contributor 403, suspended 401, admin 200 | (S-01 row) |
| Frontend integration | `AdminActivity.test.jsx` (new, MSW) | entries with name, label, target and details; admin filter (admins + System, not contributors); action filter back to page 1; Previous/Next; empty and error states | FI-33–FI-37 |
| E2E | `admin-activity.spec.js` (new, 3 browsers) | the E2E server seeds `admin2@signpak.test` as a normal verified account and sets `ADMIN_EMAILS` to it, so the real startup sync promotes it. Each admin adds a category from their own browser; Activity names the right admin for each, in both admins' views, and shows the promotion by System | E-11 |

**One existing test changed, deliberately.** `removeAllForUser.test.js` U-133, "accountDeleted
is logged only when the account deletion will go ahead", asserted exactly the behaviour item 5
removes: a log written `true` before the account had been deleted. Its first assertion now
expects `false` (the second, "files failed, so the account is kept", is unchanged), and it is
renamed "accountDeleted is never logged before the account deletion has happened". Nothing was
skipped or deleted, and the rule it checks is stricter. The new rule's other half (marked
`true` after the deletion) is U-180 and I-125, and the existing integration test
"deleting an account with withRecordings=true removes the recordings too" still checks
`accountDeleted: true` at the end.

`TEST-CASES.md`: the rows above, U-133 renamed, the Phase 7 gap row, and the counts: 83 files,
503 cases. The traceability test passes.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 22 Nov 2026. Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 182, pass 182, fail 0 | 0 |
| backend `test:integration` | tests 125, pass 125, fail 0 | 0 |
| backend `test:security` | tests 79, pass 79, fail 0 | 0 |
| backend `test:coverage` | pass 386, fail 0; overall 94.23% lines / 90.19% branches; "Coverage gate passed." | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 19 passed (19), Tests 84 passed (84) | 0 |
| frontend `test:coverage` | Lines 35.5% (was 34.05%); thresholds passed | 0 |
| frontend `build` | built; main chunk 552.31 kB (gzip 167.80 kB), was 542.63 kB | 0 |
| `e2e` | **33 passed** (1.6 m): 11 tests × Chromium, Firefox, WebKit | 0 |
| `npm audit --omit=dev --audit-level=high` (backend, frontend, e2e) | found 0 vulnerabilities ×3 | 0 |

### Coverage

| Scope | Phase 6 | Phase 7 | Floor |
| --- | --- | --- | --- |
| Backend overall | 93.88% lines / 89.61% branches | **94.23% / 90.19%** | 85 / 75 |
| `src/services` | 89.14% / 88.39% | **90.03% / 89.45%** | 80 / 75 |
| `src/middlewares` | 98.19% / 87.76% | 98.22% / 87.76% | 80 / 75 |
| `src/utils` | 99.45% / 93.41% | 99.45% / 93.41% | 80 / 75 |
| Frontend overall | 34.05% lines | **35.5%** | 18 |

### CI

The two runs on the last commit are given in the hand-off message and in a comment on the PR,
since a commit can't contain its own CI result.

## How to verify by hand

```sh
git switch fix/phase-7-admins-audit-log
cd backend  && npm ci && npm test && npm run test:coverage
cd ../frontend && npm ci && npm test && npm run build
cd ../e2e && npm ci && npm run e2e
npx playwright test tests/admin-activity.spec.js --headed --project=chromium
```

In the running app:
1. **A second admin:** sign up a new account and finish sign-up. Put its email in
   `ADMIN_EMAILS` in `backend/.env` and restart the API. That account can now open `/admin`.
2. **Activity:** with each admin, change something (a category, a message status). Admin →
   Activity shows each change under the right name, and the promotion by "System".
3. **Demotion:** remove the email from `ADMIN_EMAILS` and restart. The account is a normal
   account again, on its next request.
4. **Login log:** log in once with a wrong password and once correctly. The server log has two
   `"event":"login"` lines with `emailHash`, `outcome` and `ip`, and no email or password.

## Not done, and deviations from the plan

1. **No separate deletion-log page.** FIX-PLAN item 5 says "when this phase adds the
   deletion-log view"; the activity log is that view (`recordings.delete` with the counts, then
   `user.delete`), so no second page was added. As planned.
2. **The activity log is paged by page number** (`page`, `limit`, `total`), not by cursor like
   `GET /admin/users/:id/submissions`. The page needs "Page X of Y" and filters that reset to
   page 1. As planned.
3. **Login attempts go to the server log only**, not to the activity log (FIX-PLAN item 4 asks
   for the server log). As planned.
4. **`removeAllForUser` lost its `accountDeletion` option**, which only existed to write the
   wrong value. An old caller passing it is ignored. See the U-133 note above.

## Known risks

1. **Demotion is real.** An admin left off `ADMIN_EMAILS` (other than `ADMIN_EMAIL`) becomes a
   normal account on the next restart. Put every team member's email in the list **before**
   deploying this version.
2. **Promotion needs a restart** after the team member finishes sign-up (FIX-PLAN says so).
3. **A failed activity-log write does not undo or fail the admin's action.** The change has
   already been made, and failing the request would tell the admin it hadn't. It is logged at
   `error`, so it shows up in the PM2 logs.
4. **Names are looked up when the log is read,** so a renamed admin's old entries show the new
   name, and a deleted admin's entries show "Deleted account" with the id.
5. **Left as found:** `deleteAccount()` writes the `DeletedAccount` record before removing the
   user. If the removal fails (the I-125 case), that record stays for an account that still
   exists, so the deletion lookup can also show it as a deleted account until the admin retries. It is outside item 5, so it isn't changed here; it could go in a later
   phase.
6. **Login log lines include the IP** (as FIX-PLAN asks). They sit with the request log, which
   already records the IP of every request.

# Phase 8 – ML export and scaling (B5, B7)

## Phase and branch

| | |
| --- | --- |
| Phase | 8 – Data export for the ML team and scaling (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-8-ml-export-scaling` (from `main` @ `5f9a9e7`, Phase 7 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.13 → 1.0.14`, frontend `1.0.15 → 1.0.16` |

The branch's first commit, `b79d30f`, is your Phase 7 verification note, added to FIX-PLAN as
**Phase 8 item 6** with its test line (docs only). It is fixed in this phase.

## Checklist items

| Item | Status | Summary |
| --- | --- | --- |
| B5 | **Fixed, ticked** | `GET /admin/submissions/export?format=csv|json` (streamed, no names or emails), Admin → Submissions, and `scripts/prepare-dataset.js` to apply trim and mirror with ffmpeg. |
| B7 | **Fixed, ticked** | The dashboard renders from `GET /admin/stats` (new filters); admin lists page with a cursor; an admin's library no longer loads every submission. |
| "No admin page to browse or export submissions" (leftovers) | **Ticked** | Admin → Submissions. |
| FR13 status table | Updated | FR13.6 (trim and mirror) is now "Done (Phase 8)"; FR13.12 notes the server-side stats. |
| FIX-PLAN Phase 8 item 6 (from Phase 7 verification) | **Fixed, marked done** | `deleteAccount()` removes the user first, then writes `DeletedAccount`. |

## Your decisions in planning

1. **Pagination is opt-in** on the two existing routes: with `?limit` (and `?cursor`),
   `GET /admin/users` and `GET /submissions` answer `{ items, nextCursor, total }`. Without it
   they answer exactly as before (documented as deprecated for admins).
2. **The dashboard's contributor filter is a name/email search**, not a list of every account.

## Claims checked against the code first

All confirmed:
- **B5:** trim and mirror existed only in MongoDB, and there was no export.
- **B7:**
  - The dashboard took every submission from `LibraryProvider` (for an admin,
    `GET /submissions` returned all of them) and every user from `GET /admin/users`, then
    counted in the browser.
  - `/admin/stats` existed, unused and without filters.
  - `AdminCategories` also counted the library's submissions.
- **Item 6:** `deleteAccount()` wrote `DeletedAccount`, then cleared the cooldowns, then
  removed the user. The new integration test (I-149) failed on `main`: after a failed removal,
  a `DeletedAccount` record existed for the live account.

## What changed

### Backend
- **`GET /admin/submissions`** (B5):
  - Filters: `categoryId`, `videoId`, `userId`, `from`, `to` (`YYYY-MM-DD`, UTC, `to`
    inclusive).
  - Cursor paging on `_id`, newest first, the same scheme as the Phase 5 per-contributor list,
    so a deleted row never shifts the next page.
  - Items carry the export columns plus `contributorName` (for the admin table only).
- **`GET /admin/submissions/export?format=csv|json`** (B5):
  - **Streamed** from a MongoDB cursor, row by row, waiting on `drain`, so an export of any
    size never sits in memory.
  - Columns, in order: `submissionId, userId, videoId, videoTitle, categoryId, categoryLabel,
    driveFileId, archivePath, mimeType, size, duration, trimStart, trimEnd, mirrored,
    submittedAt`, **plus `storageDriver`** (see the deviations).
  - No names or emails.
  - CSV: RFC 4180 (`src/utils/csv.js`), UTF-8 with a BOM so Excel shows Urdu correctly, CRLF.
  - Sent as an attachment with `Cache-Control: no-store`.
  - Each export writes one `submissions.export` activity entry (a new action, also labelled in
    Admin → Activity).
  - If the database fails part-way, the response is cut rather than ended cleanly, so a
    truncated file can't be mistaken for a complete one.
- **`GET /admin/stats`** (B7):
  - New optional `userId` and `categoryId` filters.
  - Computed with one MongoDB aggregation (`$facet`: per UTC day, per video, per contributor,
    total).
  - New fields: `summary` (`recordings`, `activeContributors`, `videosRecorded`,
    `topCategory`), `topVideos`, `topContributors` and `totalsByCategory` (all-time).
  - Every existing field is still there. `totals` stays all-time; `activity`, `byCategory` and
    `recent` now follow the range and the filters (as the browser version did).
  - Day bucketing is the pure, tested `bucketByDay`.
- **`GET /admin/users`** (B7): `?limit`, `?cursor`, `?role`, `?q` (the start of a first name,
  surname or email, case-insensitive, regex characters escaped).
- **`GET /submissions`** (B7): `?mine=true` for an admin's own submissions; `?limit`/`?cursor`
  for pages. Contributors are unchanged: always their own, never archive paths, and
  `mine=false` can't widen that.
- **Item 6:** `deleteAccount()` now:
  1. calls `userRepo.remove()`;
  2. then `attemptCleanup` for the `DeletedAccount` record;
  3. then `attemptCleanup` for the cooldowns.

  A failed removal leaves nothing behind. A failed write after the removal is logged with the
  user id and doesn't fail the request.

### Dataset script: `backend/scripts/prepare-dataset.js` (B5)
- **Input and output:** reads the JSON export, downloads each recording by Drive file id (or
  reads it from `--local-root` for local storage), and writes
  `<out>/<category>/<video>/<submissionId>.mp4`.
- **ffmpeg:** `-ss trimStart -i … -t (trimEnd−trimStart) [-vf hflip] -an -c:v libx264
  -pix_fmt yuv420p`. The length is computed, so WebMs without duration information are cut
  correctly.
- **Credentials:** only the Google variables are needed. It doesn't load the server's `env.js`,
  which would require MongoDB, JWT and admin settings on a team machine.
- **Safety and re-runs:** folder names never become `.` or `..`, and a key with `..` is refused
  for local files. Existing clips are skipped unless `--overwrite`. A failed row is reported and
  the run continues; the exit code is 1 if any failed.
- **Docs:** `backend/docs/DATASET.md` (setup, ffmpeg install, credentials, columns, options).

### Frontend
- **Admin → Submissions** (new tab):
  - Filters: category, video (narrowed by the category), contributor search, from/to (an end
    before the start is flagged and nothing is requested).
  - A table with trim, mirror and size, and **Load more**.
  - **Download CSV / JSON** are plain links to the export with the same filters.
- **Dashboard:** renders only from `/admin/stats`. The contributor filter is the new
  `ContributorSearch` (debounced `GET /admin/users?role=user&q=&limit=8`); days and category
  stay selects.
- **LibraryProvider:** asks `GET /submissions?mine=true`, so admins no longer download
  everyone's submissions.
- **Admin → Categories:** the per-category recording count comes from `totalsByCategory`.
- **Admin → Users:** loads 50 accounts at a time, with a name/email search and **Load more**.
- **Admin → Activity:** loads only the admins (`role=admin`).
- **Query checks:** queries are checked with Zod before sending (`src/utils/adminQueries.js`).

## Tests

Each new test is named with its ID. Run against the unchanged code first:
- `csv`, `statsBuckets` and `prepareDataset` failed to load (the code didn't exist).
- `deleteAccountOrder` failed 3 of 3, and the item 6 integration test failed.
- `api-admin-submissions` failed 9 of 10, `api-admin-stats` 5 of 6 and `api-admin-users-paging`
  6 of 7. The few that passed check behaviour that was already right, such as the unpaged list
  answering as before.
- The access-matrix check failed: there were no routes.
- The new dashboard test failed 3 of 3 against the previous `AdminDashboard.jsx` (copied back
  temporarily, then restored).

| Level | File | Tests | Rows |
| --- | --- | --- | --- |
| Unit | `csv.test.js` (new) | plain fields; comma, quote, CR/LF quoted and quotes doubled; Urdu kept (the Arabic comma isn't a separator); null/numbers/booleans/dates; CRLF rows and the BOM | U-183–U-187 |
| Unit | `statsBuckets.test.js` (new) | zero days; the UTC midnight boundary; dates outside the range; one entry per day | U-188–U-191 |
| Unit | `prepareDataset.test.js` (new) | ffmpeg args for a trim; `hflip` for mirrored; decimal trims without float noise; an empty or reversed trim refused; safe output paths (unsafe characters, `.`/`..`, fallbacks); the run loop with a fake download and ffmpeg (converts, skips existing, overwrite, a failure reported and the run continues) | U-192–U-199 |
| Unit | `deleteAccountOrder.test.js` (new) | item 6: remove before the record; no record when the removal fails; a failed record write is logged, not thrown | U-200–U-202 |
| Integration | `api-admin-submissions.test.js` (new) | the list: fields and names for the table; each filter and date bound; cursor paging with no gaps or repeats, stable after a delete; 422s. The export: the CSV columns exactly, BOM, headers, an Urdu title with a comma and quotes round-tripped, trim/mirror values; JSON columns, types and filters; **no name or email in either**; an empty export; one audit entry; 422s | I-126–I-135 |
| Integration | `api-admin-stats.test.js` (new) | days; `userId`; `categoryId` (other categories 0); combined; the old fields and all-time totals kept; an empty range; 422s | I-136–I-141 |
| Integration | `api-admin-users-paging.test.js` (new) | the unpaged array unchanged; paging covers every account once; `role`; `q` on first name, surname and email; regex characters literal; 422s; `GET /submissions?mine=true`, its pages, and a contributor still limited to their own | I-142–I-148 |
| Integration | `api-admin-deletion.test.js` (extended) | item 6: `userRepo.remove` throws → 500, no `DeletedAccount`, and the lookup shows only the current account | I-149 |
| Security | `access-matrix.test.js` | `GET /admin/submissions` and `GET /admin/submissions/export`: anonymous 401, contributor 403, suspended 401, admin allowed | (S-01 rows) |
| Frontend integration | `AdminSubmissions.test.jsx` (new, MSW) | rows and **Load more** with the cursor; category, video (cleared by a new category) and date filters; the contributor search; the download links carry the filters; an invalid range blocks the request and the links | FI-38–FI-42 |
| Frontend integration | `AdminDashboard.test.jsx` (new, MSW) | renders everything from `/admin/stats` and **makes no submissions or users call**; days, category and contributor reach the stats query; the empty and error states | FI-43–FI-45 |
| E2E | `admin-export.spec.js` (new, 3 browsers) | a contributor makes two recordings (one trimmed and mirrored); the admin filters Admin → Submissions to their category and clicks **Download CSV**. The downloaded file's rows are exactly those two submissions, with the right video, trim and mirror, and no name or email | E-12 |

**Existing tests changed, and why.** Nothing was skipped or deleted, and no assertion was
weakened.
- **`accountDeletionLog.test.js` U-180 and U-182** (Phase 7) list the order of the deletion
  steps. Item 6 swaps two of them as you decided, so the expected lists now have
  `remove-user` before `deleted-account`. What else they check is unchanged: the deletion log
  is marked after the account is gone, and the audit entry comes last.
- **`AdminUsers.test.jsx`:** the mocked API gained `users.page` (the page now loads accounts a
  page at a time). The assertions are unchanged.
- **`AdminActivity.test.jsx`:** the `/admin/users` handler now answers the paged request the
  page makes (`role=admin`), as the API does. The assertions are unchanged, including that a
  contributor isn't offered as an admin.

**The dataset script wasn't run against real recordings:** this machine has no ffmpeg.
- **What was checked:** the unit tests cover the ffmpeg arguments, paths and the run loop. A
  smoke run of the real script with local files and a missing ffmpeg read the file, refused a
  `..` key, reported "ffmpeg was not found" and exited 1.
- **First real run:** please try it once on a team machine with ffmpeg (`docs/DATASET.md`).

`TEST-CASES.md`: the rows above, the Phase 8 gap row, and the counts: 93 files, 560 cases. The
traceability test passes.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 22 Nov 2026. Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 202, pass 202, fail 0 | 0 |
| backend `test:integration` | tests 149, pass 149, fail 0 | 0 |
| backend `test:security` | tests 81, pass 81, fail 0 | 0 |
| backend `test:coverage` | pass 432, fail 0; overall 94.55% lines / 90.11% branches; "Coverage gate passed." | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 21 passed (21), Tests 92 passed (92) | 0 |
| frontend `test:coverage` | Lines 40.5% (was 35.5%); thresholds passed | 0 |
| frontend `build` | built; main chunk 560.03 kB (gzip 169.69 kB), was 552.31 kB | 0 |
| `e2e` | **36 passed** (1.8 m): 12 tests × Chromium, Firefox, WebKit | 0 |
| `npm audit --omit=dev --audit-level=high` (backend, frontend, e2e) | found 0 vulnerabilities ×3 | 0 |

### Coverage

| Scope | Phase 7 | Phase 8 | Floor |
| --- | --- | --- | --- |
| Backend overall | 94.23% lines / 90.19% branches | **94.55% / 90.11%** | 85 / 75 |
| `src/services` | 90.03% / 89.45% | **90.78% / 89.06%** | 80 / 75 |
| `src/middlewares` | 98.22% / 87.76% | 98.38% / 88.16% | 80 / 75 |
| `src/utils` | 99.45% / 93.41% | 99.47% / 93.79% | 80 / 75 |
| Frontend overall | 35.5% lines | **40.5%** | 18 |

Two branch percentages are slightly lower: overall 90.19 → 90.11, and `src/services`
89.45 → 89.06. The new stats and export code has more fallback branches (a deleted video,
user or category) than the tests reach. Both stay well above the floors.

### CI

**First push, `5befc17`: red.** In both runs (push 44941945138, pull_request 44941963013) the
Frontend job failed in one test: FI-39, "the category, video and date filters reach the API".
Every other job passed, including E2E.

- **Cause:** the test changes three filters in a row, which starts three requests at once. They
  can reach the mock server in any order, but the test checked only the request that arrived
  *last* (`seen.at(-1)`). On CI's slower runner an earlier one arrived last.
- **The page wasn't wrong:** each superseded request's answer is dropped (the effect's `active`
  flag), so the table always shows the latest filters.
- **Fix:** the test now checks that a request with exactly those filters was made
  (`toContainEqual`), the same fix as the Phase 5 AdminMessages flake. It also checks that a
  new category clears the video. No retries or timeouts.
- **Check:** the file passed 10 of 10 local runs, and the full frontend suite passes.

The two runs on the last commit are given in the hand-off message and in a comment on the PR,
since a commit can't contain its own CI result.

## How to verify by hand

```sh
git switch fix/phase-8-ml-export-scaling
cd backend  && npm ci && npm test && npm run test:coverage
cd ../frontend && npm ci && npm test && npm run build
cd ../e2e && npm ci && npm run e2e
npx playwright test tests/admin-export.spec.js --headed --project=chromium
```

In the running app:
1. **Dashboard:** change the days, pick a category, and type part of a contributor's name.
   Every number follows. In the browser's network tab there is no `/submissions` or full
   `/admin/users` request.
2. **Admin → Submissions:** filter, use **Load more**, then **Download CSV**. Open it in Excel:
   Urdu titles show correctly, and there are no names or emails.
3. **Dataset:** download the JSON and follow `backend/docs/DATASET.md` on a machine with ffmpeg.
   A mirrored, trimmed recording comes out flipped back and cut to the trim.
4. **Admin → Users:** search by a name or an email, and use **Load more** once there are more
   than 50 accounts.

## Not done, and deviations from the plan

1. **An extra export column, `storageDriver`,** at the end, as planned. The script needs it to
   know whether a key is a Drive file id or a local path.
2. **`categoryId` in the export is the video's *current* category.** Videos can move between
   categories, and submissions don't record the category at the time.
3. **The WebM duration information is not rewritten** (the checklist says "optionally"). The
   script cuts by a computed length instead, so the missing metadata doesn't matter.
4. **`/admin/stats` `recent` and `byCategory` now follow the range and filters**, as the
   browser dashboard showed them. The new `totalsByCategory` keeps an all-time per-category
   count for Admin → Categories.
5. **The unpaged forms of `GET /admin/users` and the admin `GET /submissions` remain**
   (decision 1). Nothing in the frontend uses them any more.

## Known risks

1. **Item 6 trade-off (your decision):** if the `DeletedAccount` write fails *after* the
   removal, that account can't be found by email in the deletion lookup. It is logged at
   `error` with the user id, and its recordings are still found by that id.
2. **The CSV is not formula-escaped,** to keep values exact for the ML team. The text fields
   (`videoTitle`, `categoryLabel`) are admin-entered; nothing a contributor typed is in the
   export.
3. **Stats are UTC days** (the old browser version used local days). In Pakistan, a dashboard
   day starts at 05:00, and the chart's subtitle says "(UTC)".
4. **The export is admin-only but large.** It is streamed and logged in the activity log, and
   it holds the Drive file ids of every recording, so the file should be kept within the team.
   `DATASET.md` says the same about the script's credentials.
5. **The dataset clips have no audio and are H.264.** If the ML team needs something else, it
   is one line in `buildFfmpegArgs`.

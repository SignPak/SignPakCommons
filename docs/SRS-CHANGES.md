# SRS changes after the review fixes

What the SRS should say after Phases 0–10 of `docs/FIX-PLAN.md`. The SRS is edited by the team in
Word; it is not in this repository, so each entry gives:

- the place in the SRS;
- what the system does now, with the file that shows it;
- suggested wording to adapt.

Check each entry against the current SRS text: where the SRS already says the same, nothing needs
to change.

Status of every item: **to do (team)**.

## 1. Hosting: Figure 5 and section 3.3.4

**Now:**
- **API:** the contribution site's API runs on the team's own Linux server: a Hostinger VPS, or
  the university server, with the same setup on both. It is Node.js 22, kept running by PM2 (one
  process, fork mode), behind Nginx with HTTPS from Let's Encrypt, at `api.commons.signpak.tech`.
- **Site:** the React site stays on Vercel at `commons.signpak.tech`.
- **Not Railway, and not a backend on Vercel.** There is no Vercel- or Railway-specific code
  left (`deploy/`, `deploy/README.md`).
- **The login cookie:** the two hosts are one *site* (`signpak.tech`), so the cookie is host-only
  and `SameSite=Lax`, and works in every browser, Safari included.
- **Services:**
  - email: Brevo, from `no-reply@signpak.tech`;
  - files: Google Drive;
  - data: MongoDB Atlas.

**Suggested wording (3.3.4):**

> The contribution site is split in two. The web client, a React single-page application, is
> hosted on Vercel at `commons.signpak.tech`. The API, a Node.js 22 / Express application, runs on
> the team's own Linux server at `api.commons.signpak.tech`, kept running by PM2 behind an Nginx
> reverse proxy that terminates HTTPS (Let's Encrypt). The API stores data in MongoDB Atlas,
> stores reference videos and contributor recordings in Google Drive, and sends verification
> codes by email through Brevo.

**Figure 5:**
- Redraw the deployment boxes as: Browser → Vercel (site) and Browser → Nginx → Node/PM2 (API)
  on the team server.
- The API connects to MongoDB Atlas, Google Drive and Brevo.
- Remove any Vercel or Railway box for the backend.

## 2. Google Drive sign-in: Table 15

**Now:** Drive is reached through an **OAuth refresh token** (D3), with a service account still
supported as the alternative.

| Credential | Variables | Note |
| --- | --- | --- |
| OAuth client and refresh token (used in production) | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` | The Google Cloud OAuth consent screen must be **In production**; in "Testing" the token expires after 7 days. The API logs a clear message when the token stops working. |
| Service account (alternative) | `GOOGLE_SERVICE_ACCOUNT_JSON` | The whole JSON key as one value. |
| Folder | `GOOGLE_DRIVE_FOLDER_ID` | The shared root folder. |
| Separate account for recordings (optional) | `GOOGLE_ARCHIVE_OAUTH_*`, `GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON`, `GOOGLE_ARCHIVE_DRIVE_FOLDER_ID` | Falls back to the shared values when unset. |

**Suggested change:** add a row "Google Drive OAuth (refresh token)" next to the service-account
row and mark it as the one used. The env tables in `backend/docs/setup.md` §5 have the details.

**Team action still open (checklist D3):** set the OAuth consent screen to *In production* and
create a new refresh token.

## 3. Versions: Table 17

From the `package.json` files and lockfiles at the end of Phase 10: the version range and the
version actually installed (resolved).

**Runtime:** Node.js 22 (`.nvmrc`; CI and the server guide use 22). MongoDB through the
`mongodb` driver 5.9.2 (under Mongoose).

**Backend (API), 1.0.16**

| Package | Range | Installed |
| --- | --- | --- |
| express | ^4.22.3 | 4.22.3 |
| mongoose | ^7.8.13 | 7.8.13 |
| zod | ^4.6.7 | 4.6.7 |
| jsonwebtoken | ^9.0.3 | 9.0.3 |
| bcrypt | ^6.0.0 | 6.0.0 |
| multer | ^2.5.0 | 2.5.0 |
| helmet | ^8.3.0 | 8.3.0 |
| cors | ^2.8.6 | 2.8.6 |
| cookie-parser | ^1.4.7 | 1.4.7 |
| compression | ^1.8.2 | 1.8.2 |
| express-rate-limit | ^8.7.0 | 8.7.0 |
| googleapis | ^182.0.0 | 182.0.0 |
| @getbrevo/brevo | ^6.0.3 | 6.0.3 |
| pino / pino-http | ^10.3.1 / ^11.0.0 | 10.3.1 / 11.0.0 |
| swagger-ui-express | ^5.0.1 | 5.0.1 |
| dotenv | ^16.6.1 | 16.6.1 |

The backend's dev tools: c8 12.0.0, mongodb-memory-server 10.4.3, nodemon 3.1.14, and
ffmpeg-static 5.3.0 (the dataset script).

**Frontend (site), 1.0.18**

| Package | Range | Installed |
| --- | --- | --- |
| react / react-dom | ^19.2.8 | 19.3.0 |
| react-router-dom | ^7.9.0 | 7.18.4 |
| react-hook-form | ^7.91.0 | 7.91.0 |
| @hookform/resolvers | ^5.9.2 | 5.9.2 |
| zod | ^4.6.7 | 4.6.7 |
| tailwindcss / @tailwindcss/vite | ^4.3.3 | 4.3.3 |
| @ffmpeg/ffmpeg | ^0.12.15 | 0.12.15 |
| @ffmpeg/core (served by the site) | 0.12.10 (pinned) | 0.12.10 |
| vite (build) | ^8.3.6 | 8.3.6 |

The frontend's dev tools: vitest 5.1.1, @vitest/coverage-v8 5.1.1, eslint 10.14.0, jsdom 29.1.1,
msw 3.0.7, @testing-library/react 16.3.3.

**Removed since the SRS was written:** react-snap (prerendering) and `@ffmpeg/util`.

**End-to-end tests:** @playwright/test 1.65.1 (Chromium, Firefox and WebKit) and
@axe-core/playwright 4.14.0.

## 4. FR13.13: deleting an account and recordings

**Now, three parts:**

1. **Self-delete.** A contributor can delete their own account from the profile, after entering
   their password. It removes the account and their sign-in, but **not** their recordings: those
   stay until a deletion request is made. That is what the consent notice says
   (`frontend/src/utils/consent.js`, "Account deletion and recording retention").
2. **Deletion requests.** A deletion request is sent from the contact form ("Request
   recording/data deletion"):
   - **signed in:** verified at once;
   - **signed out:** confirmed with a 6-digit code emailed to the account's address (D4), with
     limits per IP and per device;
   - **for an address with no account:** stays "unverified" and is checked by hand.
3. **Admin deletion tools.**
   - **Admin → Messages** lists the requests with their verification state.
   - An admin can delete a contributor's recordings (the files in Drive and the records), on
     their own or with the account.
   - Each deletion is logged (`DeletionLog`, and the Activity log).

**Suggested sentence for the self-delete button:**

> A contributor can delete their account from the profile page; this removes the account and
> sign-in access but keeps their submitted recordings until they request deletion through the
> contact form, as stated in the consent notice.

**Suggested addition for the rest:**

> A signed-out deletion request is confirmed with a six-digit code sent to the account's email
> address. Administrators see verified requests in the admin workspace, and can delete a
> contributor's recordings (and, optionally, the account); every deletion is recorded.

## 5. Roles and administration: FR13.12 and the user roles

**Now (D5):**
- **Separate admin accounts.** Each team member has their own admin account. Admins are the
  account in `ADMIN_EMAIL` plus those listed in `ADMIN_EMAILS`. The list is applied at every
  start: listed accounts become admins, and admins taken off the list become normal users again.
  The roles are still only *user* and *admin*.
- **Activity log.** Every admin action is written to an activity log (Admin → Activity), with
  the admin's name and filters by admin and action. The actions are:
  - videos, categories and the demo video;
  - suspensions and reactivations;
  - account and recording deletions;
  - restrictions;
  - message status changes;
  - admin promotions and demotions;
  - exports.
- **Admin workspace tabs:**
  - Dashboard: server-side statistics, filtered by days, contributor and category;
  - Users: search, suspend and reactivate, device and IP restrictions, deletions;
  - Videos, Categories;
  - Submissions: browse and filter, and the ML export;
  - Messages;
  - Activity.

**Suggested change:** in the roles text and FR13.12, say that each administrator has a personal
account, and add the activity log and the Submissions page to the admin features.

## 6. Security requirements (SE-x)

| Requirement | Now | Where |
| --- | --- | --- |
| SE-4 login lockout | 5 wrong passwords in a row lock the account for 15 minutes, even against the right password. | `AUTH_LOCKOUT_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES` |
| SE-2 sessions | Logging out ends every session of the account, on every device ("Log out of all devices" on the profile). A password change ends every other session and keeps this one; a password reset ends them all. A contributor can change their password while logged in. | `POST /auth/logout`, `POST /users/me/password` |
| Sign-up | Email codes are valid for **10 minutes** (resend after 60 s). An unfinished sign-up is deleted 24 hours after it started. The account is only created once the consent notice is accepted. | `AUTH_OTP_TTL_MINUTES` |
| Browser security | The site sends a Content Security Policy (no inline scripts, no eval, no third-party scripts), `Referrer-Policy`, `X-Content-Type-Options: nosniff` and a `Permissions-Policy`. | `frontend/config/securityHeaders.js`, `frontend/vercel.json` |
| Request tracing | Each API response carries an `X-Request-Id`; one sent by the client is kept only if it is 1–64 letters, digits or dashes. | `backend/docs/API.md` |
| Server | Node listens only on 127.0.0.1 behind Nginx; real client IPs come from Nginx (`TRUST_PROXY`); production errors never include internal details. | `deploy/README.md` |

If the SRS gives the code expiry as something other than 10 minutes, or no lockout duration,
update it to these values.

## 7. Recordings, data and the ML dataset

**Uploads:**
- A recording can be up to **100 MB** (`MAX_RECORDING_UPLOAD_MB`).
- Only **WebM, MP4 and MOV video** is accepted. 3GP, audio-only and image files are refused.
- After an accepted upload, the same video can be recorded again after a **30-second** cooldown.

**Export for the ML team (B5):**
- Admin → Submissions exports all submissions, or a filtered set, as CSV or JSON
  (`GET /api/v1/admin/submissions/export`).
- It contains ids, the reference video and category, the storage key, size, duration, **trim
  start and end**, **mirrored**, and the submission time.
- The contributor appears only as their account id: **no names or emails**.

**Dataset script:**
- `backend/scripts/prepare-dataset.js` downloads the exported recordings and uses ffmpeg to
  apply each recording's trim and mirror. The recording in Drive is the raw take.
- The output is clips ready for training (`backend/docs/DATASET.md`).

**Suggested change:** where the SRS describes how recordings reach the ML team, describe the
export and the dataset script.

## 8. Other behaviour the SRS may describe differently

- **Contact form limits:**
  - signed-in: 1 general or partnership message a day (deletion requests don't count);
  - signed-out deletion requests: 2 a day per IP address or device;
  - a site-wide cap of 25 a day that never blocks anyone.
- **Notifications** in the site are kept per browser and device; they are not synced between
  devices.
- **Pages load on demand:**
  - every page except the landing page is downloaded the first time it is opened;
  - after a new deployment, an open tab reloads once to get it.
- **Accessibility:** the main pages are checked automatically against WCAG 2.1 A and AA (axe),
  in the light and the dark theme, and must have no serious or critical problem. If the SRS has
  an accessibility requirement (QA-20 / C.3), this is the evidence.

## 9. Testing: section 9

`backend/docs/TEST-CASES.md` is the traceability table for section 9:
- every automated test, with its requirement (FR13.x, SE-x, OR-19, UI 3.1.1.3, QA-3, QA-20) and
  its checklist ID;
- **113 test files and 766 cases** at the end of Phase 10.

| Level | Files | Cases |
| --- | ---: | ---: |
| Backend unit | 39 | 212 |
| Backend integration | 22 | 162 |
| Backend security | 8 | 81 |
| Frontend unit | 18 | 94 |
| Frontend integration | 10 | 124 |
| End-to-end (Chromium, Firefox, WebKit) | 16 | 93 |

- **Traceability:** a test fails if any FR13.1–FR13.13 has no test.
- **Production smoke:** a read-only `@smoke` subset (login, library, profile) can be run against
  the live site (`e2e/README.md`).
- **Coverage:**
  - backend: about 95% of lines;
  - frontend: 55% of lines overall, and over 98% of the API client and the helper modules.
- **The rest of the gate:** CI runs the whole gate on every push and pull request.

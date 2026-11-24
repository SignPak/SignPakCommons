# SRS changes after the review fixes

What the SRS (v1.1) should say after Phases 0–10 of `docs/FIX-PLAN.md`. The SRS is edited by the
team in Word; it is not in this repository. Each entry gives:

- **Current text:** the SRS text as it reads in v1.1, quoted, so it can be found with a search.
- **Now:** what the system does, with the file that shows it.
- **Suggested:** replacement wording to adapt, or "no change needed".

| # | SRS place | Status |
| --- | --- | --- |
| 1 | §2 Deployment Diagram: the Figure 5 intro, and Figure 5 | To do (team) |
| 2 | §3.3.4: the Community Contribution Site bullet | To do (team) |
| 3 | Table 15 and the paragraph under it | To do (team) |
| 4 | Table 17 | **No change needed** |
| 5 | FR13.1 | No change needed (optional addition) |
| 6 | FR13.12 | To do (team) |
| 7 | FR13.13 | To do (team) |
| 8 | SE-4 | **No change needed** |
| 9 | SE-1, SE-2, SE-8 and the code expiry (FR1.3 / FR1.5) | No change needed (optional addition) |
| 10 | FR13.8, OR-10, FR12.1: recordings and the ML dataset | No change needed (optional addition) |
| 11 | QA-20 / C.3, and behaviour the SRS doesn't describe | **No change needed** |
| 12 | §9 Testing: Contributor Testing | No change needed (optional addition) |

## 1. The Figure 5 intro and Figure 5 (§2, Deployment Diagram)

**Current text (the end of the Figure 5 intro):**

> "...while sentence generation is handled by the Groq cloud API and the Community Contribution
> Site runs on Vercel (Section 3.3.4)."

**Now:** only the site runs on Vercel. Its API runs on the team's own Linux server
(`deploy/README.md`).

**Suggested replacement for that clause:**

> "...while sentence generation is handled by the Groq cloud API, and the Community Contribution
> Site runs on Vercel with its API on the team's own server (Section 3.3.4)."

**Figure 5:**
- Show the site as Browser → Vercel.
- Show its API as Browser → Nginx → Node.js (PM2) on the team server, at
  `api.commons.signpak.tech`.
- The API connects to MongoDB Atlas, Google Drive and Brevo.
- No backend box on Vercel (and none on Railway, which the code also no longer uses).

## 2. The Community Contribution Site bullet (§3.3.4)

**Current text:**

> "A separate web application built with React 19, Vite and Tailwind CSS, hosted on Vercel. It
> has its own backend (Express on Node.js with a MongoDB database). Submitted recordings are
> stored on Google Drive through a service account, and email verification and password reset
> codes are sent through Brevo."

**Now:**
- **The site** (React, Vite, Tailwind CSS) is on Vercel at `commons.signpak.tech`.
- **The backend** (Express on Node.js 22, MongoDB Atlas) runs on the team's own Linux server at
  `api.commons.signpak.tech`, behind Nginx with HTTPS (Let's Encrypt), kept running by PM2.
  - The server is a Hostinger VPS or the university server; the setup works on both (FIX-PLAN D1).
- **Google Drive** is connected through an OAuth refresh token; a service account is still
  supported as the fallback (D3).
- **Brevo** sends the codes, from `no-reply@signpak.tech`. Besides verification and password
  reset, it also sends the codes that confirm a signed-out deletion request.

**Suggested replacement:**

> "A separate web application built with React 19, Vite and Tailwind CSS, hosted on Vercel. Its
> backend (Express on Node.js with a MongoDB database) runs on the team's own Linux server
> behind an Nginx reverse proxy with HTTPS. Submitted recordings are stored on Google Drive
> through an OAuth refresh token (a service account can be used instead), and email
> verification, password reset and deletion-request codes are sent through Brevo."

## 3. Table 15 and the paragraph under it

**Current text:**
- **Title:** "Table 15. Comparison of Community Contribution Site hosting and storage".
- **Columns:** "Vercel + Google Drive (chosen)", "University server" and "Paid cloud (e.g.,
  AWS S3 storage + EC2 server)".
- **Rows:** "Team access to recordings", "Public availability for volunteers" and "Setup and
  maintenance".
- **The paragraph under it:**

  > "The contribution site has to be reachable by volunteers at any time. Hosting it on Vercel
  > keeps it separate from the university server. Google Drive was simple to connect through a
  > service account, and the team can open and download the recordings directly when preparing
  > training data."

**Now:** the site is on Vercel, the API on the team's own server, and the files on Google Drive.
The chosen option is therefore no longer "Vercel + Google Drive".

**Suggested:**
- **Rename the chosen column** to "Vercel (site) + team server (API) + Google Drive".
- **Its row values:**

| Row | Suggested value for the chosen column |
| --- | --- |
| Team access to recordings | The team opens and downloads the recordings directly in Google Drive. The admin export lists every recording with its trim and mirror values, and the dataset script applies them. |
| Public availability for volunteers | The site is served by Vercel. The API runs on the team's server behind Nginx with HTTPS, and PM2 restarts it if it stops. Both are reachable at any time, independent of any one person's computer. |
| Setup and maintenance | Vercel builds and hosts the site. The team maintains one Linux server (Node.js 22, PM2, Nginx and certificate renewal), with scripts and a step-by-step guide in the repository. The Google OAuth consent screen must stay "In production". |

- **The other two columns can stay as they are.** "University server" compares hosting
  everything there. The team server for the API may itself be the university server: D1 leaves
  the choice between a Hostinger VPS and the university server open.

**Suggested replacement paragraph:**

> "The contribution site has to be reachable by volunteers at any time. The site is hosted on
> Vercel, and its API runs on the team's own Linux server behind Nginx at
> `api.commons.signpak.tech`. Because the API is on the same site as `commons.signpak.tech`, the
> login cookie works in every browser, including Safari. Google Drive is connected through an
> OAuth refresh token, with a service account as the fallback, and the team can open and
> download the recordings directly when preparing training data."

## 4. Table 17: no change needed

**Current text:** "Table 17. Minimum software versions". The contribution site's rows:

| Row | Minimum (SRS) | Installed now | Meets it |
| --- | --- | --- | --- |
| Contribution site: React / Vite / Tailwind CSS | 19.2 / 8.3 / 4.3 | 19.3.0 / 8.3.6 / 4.3.3 | yes |
| Contribution site: Node.js / Express / Mongoose | 22 or later / 4.22 / 7.8 | 22 / 4.22.3 / 7.8.13 | yes |

The installed versions come from the lockfiles at the end of Phase 10, and Node 22 from `.nvmrc`.
Every row is still met. **No change needed.**

## 5. FR13.1: no change needed (optional addition)

**Current text:**

> "The system shall let volunteers sign up with a first name, surname, email address and
> password, and verify the email address with a 6-digit code. Contributors who forget their
> password can reset it with a 6-digit emailed code."

**Now:**
- **What the text says still holds.** Volunteers sign up with a first name, surname, email
  address and password, and verify the address with a 6-digit code (E2E test E-03). A forgotten
  password is reset with a 6-digit emailed code (E-09).
- **New since the review:** a signed-in contributor can also change their password from the
  profile. They enter the current password and the new one twice; every other session is then
  signed out (`POST /users/me/password`, Phase 6).

**Suggested addition (optional):**

> "A signed-in contributor shall be able to change their password, after entering the current
> one; other signed-in sessions of the account are then ended."

## 6. FR13.12

**Current text:**

> "The system shall let site admins view contribution statistics, suspend or delete
> contributors, and restrict access from an IP address or device. Suspended contributors cannot
> log in or submit recordings."

**Now:**
- **What the text says still holds.** A suspended contributor's open session can't submit, and
  they can't log in (E2E test E-26). A device or IP restriction blocks access until an admin
  removes it (E-27, I-45).
- **Personal admin accounts.** Each team member has their own admin account (`ADMIN_EMAIL` plus
  `ADMIN_EMAILS`, applied at every start; D5).
- **Activity log.** Every admin action is recorded in an activity log (Admin → Activity).
- **Submissions.** Admins can browse all submissions and export them for the ML team (Admin →
  Submissions).

**Suggested: keep the current text and add:**

> "Each site admin uses a personal admin account, and every admin action is recorded in an
> activity log that admins can view. Site admins can browse all submissions and export them
> for training, without contributors' names or email addresses."

## 7. FR13.13

**Current text:**

> "The system shall let contributors ask the site admins, through the contact form, to delete
> their account and recordings. Recordings already used to train a released model remain in
> that model."

**Now:**
- **Self-delete.** A contributor can delete their own account from the profile, after entering
  their password. This removes the account and their sign-in, but **not** their recordings,
  which stay until a deletion request is made. This is what the consent notice says
  (`frontend/src/utils/consent.js`, "Account deletion and recording retention").
- **Deletion requests through the contact form:**
  - from a signed-in contributor: verified at once;
  - from a signed-out contributor: confirmed with a 6-digit code emailed to the account's address
    (D4);
  - for an address with no account: they stay "unverified" and are checked by hand.
- **Admin side.** Admins see each request with its verification state (Admin → Messages) and
  can delete that contributor's recordings, with or without the account. Every deletion is
  recorded.

**Suggested replacement:**

> "The system shall let contributors ask the site admins, through the contact form, to delete
> their account and recordings; a request made while signed out is confirmed with a six-digit
> code sent to the account's email address. Site admins shall be able to delete a contributor's
> recordings, with or without the account, and every deletion is recorded. A contributor can
> also delete their account from the profile page; this removes the account and sign-in access
> but keeps their submitted recordings until they request deletion through the contact form, as
> stated in the consent notice. Recordings already used to train a released model remain in
> that model."

## 8. SE-4: no change needed

**Current text:** "After 5 failed login attempts, the account shall be locked for 15 minutes."

**Now:** 5 wrong passwords in a row lock the account for 15 minutes, even against the right
password (`AUTH_LOCKOUT_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES`; tests I-86 and E-08). **No change needed.**

## 9. SE-1, SE-2, SE-8 and the code expiry: no change needed (optional addition)

**Current text.** These requirements are written for the main app, not the contribution site:

- **SE-1:** "The system shall enforce two roles, App User and Admin. Only admins shall be able to
  use the Admin Panel and the admin APIs."
- **SE-2:** "Sessions shall use JWTs that expire after 7 days (FR1.6). Logging out shall remove
  the token from the device."
- **SE-8:** "Admin actions and login attempts shall be recorded in the server logs."
- **Code expiry**, in FR1.3 / FR1.5: "valid for 10 minutes", "expires after 10 minutes".

**Now.** The contribution site meets or exceeds each of these:

| Requirement | The contribution site | Where |
| --- | --- | --- |
| SE-1 roles | Two roles, contributor and admin. Every admin route is refused to anyone else, checked route by route by the security test suite's access matrix. | `backend/tests/security/access-matrix.test.js` |
| SE-2 sessions | JWTs that expire after 7 days (`JWT_EXPIRES_DAYS`). Logging out also ends the session **on the server**, on every device; a password change ends the other sessions. | `POST /auth/logout`, `POST /users/me/password` |
| SE-8 logging | Every admin action goes to the activity log (Admin → Activity). Login attempts go to the server log, with the email hash, the outcome and the IP. | Phase 7 |
| Code expiry | Email codes last 10 minutes (resend after 60 s). | `AUTH_OTP_TTL_MINUTES` |

**Beyond the SRS:**
- an unfinished sign-up is deleted after 24 hours;
- the site sends a Content Security Policy and other security headers
  (`frontend/config/securityHeaders.js`);
- an incoming `X-Request-Id` is kept only if it is 1–64 letters, digits or dashes;
- Node listens only on 127.0.0.1 behind Nginx.

**Suggested: no change needed.** Optionally, one sentence in §3.3.4 or §4.13:

> "The Community Contribution Site applies the same security rules as the main app: an account
> is locked for 15 minutes after 5 failed logins, email codes expire after 10 minutes, and admin
> actions and login attempts are logged. In addition, unfinished sign-ups are deleted after 24
> hours, and the site sends a Content Security Policy."

## 10. FR13.8, OR-10 and FR12.1: no change needed (optional addition)

**Current text:**

> **FR13.8:** "The system shall store submitted recordings on Google Drive and their details in
> the database."

> **OR-10:** "Data of the Community Contribution Site shall be kept separately: accounts and
> metadata in MongoDB, recordings on Google Drive (Section 3.3.4)."

> **FR12.1:** "The system shall support model training, validation and testing using the
> collected PSL dataset."

**Now:**
- **Storage still matches.** Recordings are stored on Google Drive, and accounts and recording
  details in MongoDB.
- **Uploads:**
  - A recording can be up to 100 MB (`MAX_RECORDING_UPLOAD_MB`).
  - Only WebM, MP4 and MOV video is accepted; 3GP, audio-only and image files are refused.
  - After an accepted upload, the same video can be recorded again after a 30-second cooldown.
- **Export (B5):** Admin → Submissions exports all submissions, or a filtered set, as CSV or JSON
  (`GET /api/v1/admin/submissions/export`).
  - It contains ids, the reference video and category, the storage key, size, duration, trim
    start and end, mirrored, and the submission time.
  - The contributor appears only as their account id, with no names or emails.
- **The dataset script:** `backend/scripts/prepare-dataset.js` applies each recording's trim and
  mirror with ffmpeg when preparing training clips. The recording in Drive is the raw take
  (`backend/docs/DATASET.md`).

**Suggested: no change required.** Optionally, one sentence after FR13.8:

> "Site admins can export the recordings' details, including the trim and mirror settings, as
> CSV or JSON, and a dataset script applies the trim and mirror when preparing training clips."

## 11. QA-20 / C.3, and behaviour the SRS doesn't describe: no change needed

**Current text:**

> **QA-20:** "Text shall have a contrast ratio of at least 4.5:1, or 3:1 for large text."

C.3 says the same.

**Now:**
- **QA-20 / C.3:** the site's main pages are checked automatically with axe against WCAG 2.1 A
  and AA, colour contrast included, in the light and the dark theme. A serious or critical problem
  fails the build (E-18–E-20). This is evidence for QA-20 / C.3. **No change needed.**
- **Not described in the SRS, so no change needed:**
  - **Contact form limits:**
    - signed in: 1 general or partnership message a day (deletion requests don't count);
    - signed-out deletion requests: 2 a day per IP address or device;
    - a site-wide cap of 25 a day that never blocks anyone.
  - **Notifications** are kept per browser and device; they are not synced between devices.
  - **Pages load on demand:** every page except the landing page is downloaded the first time it
    is opened, and after a new deployment an open tab reloads once to get it.

## 12. §9 Testing: no change needed (optional addition)

**Current text:**

> "Contributor Testing: Recording, trimming and submitting a sign, the consent notice, the
> cooldown, and the site admin's statistics and contributor controls (FR13.1–FR13.13)"

**Now:** `backend/docs/TEST-CASES.md` is the evidence. It maps every automated test to its
requirement (FR13.x, SE-x, OR-19, UI 3.1.1.3, QA-3, QA-20) and checklist ID. At the end of Phase
10 it has **113 test files and 766 cases**:

| Level | Files | Cases |
| --- | ---: | ---: |
| Backend unit | 39 | 212 |
| Backend integration | 22 | 162 |
| Backend security | 8 | 81 |
| Frontend unit | 18 | 94 |
| Frontend integration | 10 | 124 |
| End-to-end (Chromium, Firefox, WebKit) | 16 | 93 |

- **Traceability:** a test fails if any of FR13.1–FR13.13 has no test.
- **The FR13 flows the text names:**
  - recording, trimming and submitting, with the cooldown (E-25);
  - the consent notice (E-03, E-10);
  - the admin's statistics (FI-43–FI-45);
  - the contributor controls (E-26, E-27).
- **Smoke:** a read-only `@smoke` subset (login, library, profile) can be run against the live
  site (`e2e/README.md`).
- **CI** runs the whole gate on every push and pull request.

**Suggested: no change needed.** Optionally, one sentence in §9.x:

> "The contribution site's tests are automated: unit, integration, security and end-to-end
> (Playwright, in Chromium, Firefox and WebKit) suites run on every change, and a traceability
> table maps each test to its FR13 requirement."

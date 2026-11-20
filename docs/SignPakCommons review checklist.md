# SignPakCommons – review checklist (Nov 19, 2026)

Repo: https://github.com/SignPak/SignPakCommons, reviewed at commit `b10d90b` (Oct 24, 2026).
The local copy at `C:\Abdullah\Not Backed up\MCS 7th sem\FYP-I\Projects\SignPakCommons` matches GitHub. Nothing was changed during the review.

**Status:** about 90% complete. FR13.1–FR13.12 and OR-19 (consent) are implemented. FR13.13 does not work.
**Checks run:** frontend lint is clean, 20/20 tests pass and the build succeeds. The backend tests were not run (the MongoDB test binary download was too slow).

## FR13 status

| Req | Status | Notes |
| --- | --- | --- |
| FR13.1 Sign-up, 6-digit code, password reset | Done | Codes expire after 5 min by default (`AUTH_OTP_TTL_MINUTES`). |
| FR13.2 Categories, browse, search | Done | Search and sort in `CategoryBrowser.jsx`. |
| FR13.3 Reference video playback | Done | |
| FR13.4 Camera recording in the browser | Done | Video only, no audio. |
| FR13.5 Review, record again or delete before submitting | Done | |
| FR13.6 Trim and mirror | Partly | Stored only as metadata. The file on Drive is untrimmed and unmirrored. |
| FR13.7 10 min / 100 MB limits | Done | Checked on both frontend and backend. |
| FR13.8 Drive storage and DB details | Done | Temp files leak (see C5). |
| FR13.9 30 s cooldown | Done | Atomic claim in `submissionRepo.claimCooldown`. |
| FR13.10 Coverage count, GitHub/LinkedIn | Done | |
| FR13.11 Admin videos, posters, categories, demo video | Done | |
| FR13.12 Stats, suspend/delete, IP/device restriction | Done | Dashboard stats are worked out in the browser (see B7). |
| FR13.13 Deletion request through the contact form | **Not working** | See C2 and C3. |
| OR-19 Consent notice | Done | Version `2026-10-15`, the same on frontend and backend. |

## Critical (fix first)

- [ ] **C1. The live backend is down.** *(Phase 1: code and deployment files done — `deploy/` (Nginx, PM2, deploy.sh, server guide), health reports storage, graceful shutdown. **Pending:** deploying to `api.<DOMAIN>` once the domain and server exist; see `docs/phase-reports/PHASE-1.md`.)* The deployed frontend calls `https://signpakcommons-production.up.railway.app`, which answers `404 Application not found`. Nobody can log in or upload on commonssignpak.vercel.app.
  - Redeploy or restore the backend.
  - Set `VITE_API_ORIGIN` to the new URL and rebuild the frontend.
- [ ] **C2. The contact form never sends.** In `frontend/src/pages/Landing.jsx`, `ContactForm.submit()` sets `status = 'sending'` and never calls `api.contact.send`, so the button stays on "Sending…".
  - Connect the call and handle success and errors.
  - Restore the topic `<select>`, which is commented out.
  - For signed-out visitors, default the topic to `recording-deletion`. Otherwise `contactService.send` treats a signed-out `general` message as abuse and blocks the device for 10 minutes.
- [ ] **C3. Recordings can't be deleted (FR13.13).** No route deletes submissions. Admin delete (`userService.remove`) and self-delete (`removeSelf`) remove only the User document; the Drive files and Submission documents stay.
  - Add an admin endpoint and UI that deletes one contributor's recordings: the Drive files (`storageService.remove`) and the Submission documents.
  - Add an option to do this when deleting a user.
  - Keep a record that the deletion happened.
- [ ] **C4. The cookie is cross-site, so login breaks in Safari/iOS, Brave and incognito.** *(Phase 1: first option chosen (D2): `commons.<DOMAIN>` + `api.<DOMAIN>`, host-only `SameSite=Lax` cookie, proven across two hostnames in E2E. **Pending:** the real-browser checks on the deployed domain.)* The frontend (`*.vercel.app`) and API (`*.railway.app`) are on different sites, so the cookie must be `SameSite=None` and browsers that block third-party cookies drop it. Either:
  - put both on one domain (for example `commons.example.org` and `api.example.org`) with `COOKIE_SAMESITE=lax`, or
  - proxy `/api/*` through a rewrite in `frontend/vercel.json`, so requests stay on the same origin.
- [ ] **C5. Temp files are never deleted when the storage is Drive.** In `backend/src/services/storage/googleDriveDriver.js`, `save()` uploads from the temp file but never deletes it (only `localDriver` moves it). Every upload, up to 100 MB, stays in `uploads/tmp`.
  - Call `removeQuietly(tempPath)` after a successful save in `storageService.save` and `storageService.archive`.

## Security

- [ ] **S1. Vulnerable packages.** `npm audit` in the backend shows high issues in body-parser, mongoose 7.0–7.8.12, multer 2.0–2.4.0 and zod <4.6.6, and moderate issues in qs and ip-address. Run `npm audit fix` and bump the versions, then re-run the tests. Frontend: vite 8.3.0–8.3.2 (dev server only).
- [ ] **S2. Add a per-account login lockout.** Lock the account for 15 minutes after 5 failed attempts (matching SE-4). Today there is only an IP limit of 20 attempts per 15 minutes (`authLimiter`).
- [ ] **S3. Proxy and rate-limit setup.** *(Phase 1: `TRUST_PROXY=true` in `backend/.env.production.example`, a startup warning when it is off in production, request logs record the visitor IP. Rate limits stay in memory with one PM2 process, as FIX-PLAN D1 decides, instead of an Upstash store. **Pending:** confirming real IPs in the server logs.)*
  - Set `TRUST_PROXY=true` on the host. Without it, all users share one IP and get 20 login attempts per 15 minutes in total.
  - The limits are kept in memory and reset on restart. Consider an Upstash-backed store, since Upstash is already configured.
- [ ] **S4. Contact form abuse** (`contactService.js`):
  - Anyone can use up the site-wide cap (`CONTACT_DAILY_LIMIT`, 25 a day), and whoever hits it is then blocked for 10 minutes. Make the cap per IP or device, and stop blocking the user who happens to hit it.
  - Signed-out deletion requests aren't verified. Confirm through the account email (for example a code or link) before acting.
- [x] **S5. Error details leak in the 503 response.** *(Phase 1: `detail` only outside production; proven by a security test that runs a real production process.)* `ensureServicesInitialized` in `backend/src/services/initialization.js` returns `detail: error.message`. Remove it in production.
- [ ] **S6. Logout doesn't end the session on the server.** The JWT stays valid for 7 days. Bump `authVersion` on logout, or add "log out of all devices".
- [ ] **S7. One shared admin account.** The only admin comes from `ADMIN_EMAIL`, so four people share one password. Add a way to promote team accounts to admin, and an audit log of admin actions (who did what, when).
- [ ] **S8. Frontend headers.** Add a Content-Security-Policy and other security headers in `vercel.json`. Pin the ffmpeg core instead of loading it from jsDelivr unchecked (`frontend/src/utils/processVideo.js`), or host it on the site itself.
- [ ] **S9. Unfinished sign-ups never expire.** Unverified users stay forever and hold their email address. Add a TTL clean-up (for example 24 h after `createdAt` when `emailVerified=false`).
- [ ] **S10. Minor items:**
  - Limit the length of `X-Request-Id` and clean it before logging.
  - `X-Device-ID` is made by the client, so device blocks are easy to get around. IP is the real control.

## Bugs

- [ ] **B1. The cooldown stays stuck when clean-up fails.** In `submissionService.create`, if `storageService.remove()` throws inside the `catch`, the cooldown is never released and the original error is lost. `videoService.create` has the same pattern. Wrap the clean-up in its own try/catch and always rethrow the original error.
- [ ] **B2. Contributor counts include unfinished sign-ups.** `countByRole(USER)` in `publicStatsService` and `statsService` also counts unverified accounts. Filter on `emailVerified: true`.
- [ ] **B3. Signing up again with a pending email is a dead end.** It returns 409 "already exists, log in", and login then says "verify your email". Either resend the code and send the user to verification, or replace the old pending account.
- [ ] **B4. Refreshing the consent page loses the token.** `Consent.jsx` keeps `consentToken` only in `location.state`. Keep it in `sessionStorage`.
- [ ] **B5. Trim and mirror aren't applied to the files.** Drive holds the raw WebM (often without duration information), and trim and mirror exist only in MongoDB. Add an export (CSV/JSON) for the ML team: user, video, category, Drive file ID, trimStart, trimEnd, mirrored, duration, date. Optionally fix the WebM duration information.
- [ ] **B6. The file check is too loose.** `sniffVideo` in `backend/src/utils/files.js` accepts any `ftyp` file (m4a, heic, 3gp) as MP4. Check the brand against a list of video brands.
- [ ] **B7. The admin dashboard won't scale.** `AdminDashboard.jsx` downloads every submission and every user and calculates the stats in the browser; the `/admin/stats` endpoint exists but isn't used. Use the endpoint, and add pagination to `/admin/users` and `/submissions` (admin).
- [ ] **B8. Duplicate Drive folders.** Two uploads at the same moment can create duplicate folders (the in-memory cache in `folderIdFor`). Low priority.

## Unfinished parts and leftovers

- [ ] There is no admin page for contact messages. The `GET /admin/messages` endpoint exists but nothing uses it.
- [ ] There is no admin page to browse or export submissions (this ties in with B5).
- [ ] There is no way to change the password while logged in; only reset by email works.
- [ ] `SITE_URL` in `frontend/src/seo/seoCatalog.mjs` is still `https://signpakcommons.example`, so the sitemap and robots file are wrong. *(Phase 1: now read from the `SITE_URL` env var, default `https://commons.<DOMAIN>`, with a build warning. **Pending:** setting it in Vercel once the domain exists.)*
- [ ] Remove the unused `frontend/src/utils/blobStore.js`. Notifications are only stored in the browser (`api.notifications`); decide whether that is enough.
- [ ] The main bundle is 526 KB. Load the admin pages and the ffmpeg tool separately.
- [x] The backend tests run only on pull requests (`.github/workflows`). Also run them on pushes to `main`. *(Phase 0: `.github/workflows/ci.yml` runs backend, frontend, e2e and audit jobs on every push and pull request; the two old workflows were folded into it.)*
- [ ] If the Google sign-in (OAuth) app for Drive is still in "Testing" mode, its refresh token expires every 7 days and uploads break. Publish the app, or use a service account.
- [ ] **Clean-up:** `console.error('UPLOAD ERROR…')` in `videoController.create`, and the duplicate credential parser (`utils/parseCredentials.js` and `parseCredentials` in `googleDriveDriver.js`).

## SRS mismatches (fix the code or the SRS)

- The SRS (Figure 5, 3.3.4) says the site's backend runs on Vercel and stores files through a Drive service account. In practice the backend is on Railway, and the setup prefers a Google sign-in (OAuth) refresh token.
- Codes expire after 5 minutes by default; the app decision in the SRS is 10 minutes.

## Suggested order for Claude Code

1. C1 and C4: deployment, one domain, `TRUST_PROXY`.
2. C2 and C3: contact form and recording deletion (FR13.13).
3. C5 and B1: temp-file leak and cooldown release.
4. S1: `npm audit fix`, then run the tests.
5. S2, S4, S5 and S6: lockout, contact abuse, error leak, logout.
6. B2–B7, then the remaining items and the leftovers.

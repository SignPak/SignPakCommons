# Changelog

The fixes from the project review (`docs/SignPakCommons review checklist.md`), done phase by phase
as `docs/FIX-PLAN.md` lays out. Each phase bumped the backend and/or frontend version once; the
IDs are the checklist's (C = critical, S = security, B = bug, D = decision). The full account of
each phase, with its tests and gate results, is in `docs/phase-reports/PHASE-N.md`.

Versions are `backend / frontend`. The e2e package stays at 1.0.0 (it is never released).

## Phase 10: docs, SRS sync and final check (1.0.16 / 1.0.18), 2026-11-23

- `docs/SRS-CHANGES.md`: the SRS (v1.1) updates for the team, each quoting the current text:
  the Figure 5 intro, the §3.3.4 site bullet, Table 15 (hosting and storage), FR13.1, FR13.12,
  FR13.13 and the security, data and testing changes. Table 17 and SE-4 need no change.
- Docs: every env variable is now in both `.env` examples and the tables in `setup.md`; new
  tests keep the OpenAPI spec and the env docs in step with the code.
- Traceability: a test fails if any FR13.x or checklist ID has no test.
- E2E for every automatable line of the production checklist: record → trim → mirror → submit
  → cooldown, suspension, device restrictions, the 100 MB upload limit. A read-only `@smoke`
  subset runs against production with `npm run e2e:smoke -- --base-url=…`.
- Frontend coverage: `src/services` and `src/utils` above 98% lines; floors raised.

## Phase 9: frontend hardening (1.0.15 / 1.0.17), 2026-11-22

- **S8:** a CSP and security headers (Vercel and `vite preview`, from one module). No inline
  script, no eval. The ffmpeg core is served by the site, and the sign-in photo is self-hosted.
  Every E2E test runs under the CSP.
- **S10:** `X-Request-Id` is kept only if it is 1–64 letters, digits or dashes.
- The main chunk went from 560 kB to 269 kB (lazy pages, Zod with its schemas); CI fails above
  300 kB. A tab opened before a deploy reloads once for the new chunks.
- react-snap and `blobStore.js` removed; axe (WCAG 2.1 AA) checks on the main pages.

## Phase 8: ML export and admin scaling (1.0.14 / 1.0.16), 2026-11-22

- **B5:** CSV and JSON export of submissions (no names or emails), Admin → Submissions, and
  `scripts/prepare-dataset.js`, which applies trim and mirror with ffmpeg.
- **B7:** the dashboard uses server-side stats; admin lists page with a cursor.
- `deleteAccount()` removes the user before writing `DeletedAccount`.

## Phase 7: admins and activity log (1.0.13 / 1.0.15), 2026-11-22

- **S7 / D5:** separate admin accounts from `ADMIN_EMAIL` and `ADMIN_EMAILS`, synced at startup;
  every admin action goes into an activity log (Admin → Activity).
- Login attempts are logged with the email hash, the outcome and the IP.
- `DeletionLog.accountDeleted` is set only once the account is really gone.

## Phase 6: account security (1.0.12 / 1.0.14), 2026-11-21

- **S2:** 5 wrong passwords lock an account for 15 minutes.
- **S6:** logout and a password reset end every session; "Log out of all devices".
- **S9:** unfinished sign-ups are deleted after 24 hours.
- **B2, B3, B4:** contributor counts include only finished sign-ups; signing up again works safely;
  the consent page survives a reload.
- Password change while logged in. Email codes last 10 minutes.

## Phase 5: admin deletion tools (1.0.11 / 1.0.13), 2026-11-21

- **C3:** an admin can delete a contributor's recordings (files and records), alone or with the
  account; every deletion is logged. Admin → Messages for contact messages and deletion requests.

## Phase 4: contact form and deletion requests (1.0.10 / 1.0.12), 2026-11-21

- **C2:** the landing-page contact form sends through the API.
- **S4 / D4:** signed-out deletion requests are confirmed with an emailed 6-digit code and have
  their own per-IP and per-device limit; nothing in the contact flow blocks anyone.

## Phase 3: dependency updates (1.0.9 / 1.0.11), 2026-11-21

- **S1:** every production dependency with an advisory updated within its major version;
  `npm audit --omit=dev` finds nothing high. The CI audit job is required.

## Phase 2: storage reliability (1.0.8 / 1.0.10), 2026-11-21

- **C5:** temp upload files are always deleted; old ones are cleared at startup.
- **B1:** a failing clean-up step no longer hides the original error or keeps the cooldown.
- **B6:** 3GP, audio-only and image files are refused; only WebM, MP4 and MOV video is accepted.
- **B8:** concurrent uploads share one Drive folder lookup.
- **D3:** a clear log message when the Drive refresh token stops working.

## Phase 1: server, domain and sessions (1.0.7 / 1.0.10), 2026-11-20

- **C1:** `deploy/` for the team's server: Nginx, PM2, the deploy script and the server guide.
- **C4 / D2:** the site at `commons.signpak.tech` and the API at `api.commons.signpak.tech`, one
  site, so the host-only `SameSite=Lax` login cookie works in every browser.
- **S3:** `TRUST_PROXY` and real client IPs. **S5:** no error details in production.
- `SITE_URL` for the sitemap and robots file.

## Phase 0: baseline and test infrastructure (1.0.6 / 1.0.9), 2026-11-20

- Unit, integration, security and E2E test levels, coverage floors, and one CI workflow that
  runs backend, frontend, e2e and audit jobs on every push and pull request.

## Before the review fixes (1.0.5 / 1.0.8)

The versions the review (`docs/SignPakCommons review checklist.md`) looked at.

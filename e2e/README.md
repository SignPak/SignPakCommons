# End-to-end tests

Playwright drives the real site against a real API, in Chromium, Firefox and WebKit.

## Running them

```sh
cd e2e
npm ci
npx playwright install   # one-off: downloads the three browser engines
npm run e2e              # all browsers
npm run e2e:chromium     # just Chromium, while writing a test
npm run e2e:report       # open the HTML report from the last run
```

Playwright starts both servers itself, so nothing needs to be running first:

| Server | Command | Address |
| --- | --- | --- |
| API | `npm run e2e:server` in `backend/` (`backend/scripts/e2e-server.js`) | `http://127.0.0.1:5099` |
| Site | `npm run build && npm run preview` in `frontend/` | `http://127.0.0.1:4173` |

The API runs with an in-memory MongoDB, local file storage in a temporary folder, and the
capture email driver, so a run touches no real database, Drive folder or mailbox. The preview
server proxies `/api` to the API (see `preview.proxy` in `frontend/vite.config.js`), which
keeps the site and the API on one origin so the session cookie behaves the same in every
engine. Ports can be overridden with `E2E_API_PORT` and `E2E_WEB_PORT`.

## Reading verification codes

Sign-up, password reset and (from Phase 4) deletion requests all need the six-digit code that
was "emailed". The capture email driver keeps those in memory and the API exposes them at:

```
GET http://127.0.0.1:5099/__test/emails?to=<email>&purpose=email-verification
```

That route is mounted only when `NODE_ENV=test` **and** `E2E_TEST_HOOKS=true`.
`backend/src/config/env.js` refuses to start when either is set with `NODE_ENV=production`,
and `backend/tests/security/test-hooks.test.js` proves the route is absent without the flag,
so it cannot reach the deployed API.

## Current coverage

| Spec | Flow |
| --- | --- |
| `tests/landing.spec.js` | the landing page renders with no console or page errors; the API is reachable through the proxy |
| `tests/signup.spec.js` | sign-up → emailed code → consent → library |
| `tests/cross-host-cookie.spec.js` | the login cookie set by `api.localtest.me` works on `commons.localtest.me` (C4) |
| `tests/account-security.spec.js` | five wrong passwords lock the account (S2); a password reset on another device logs the old session out (S6); reloading the consent page keeps the visitor on it (B4) |
| `tests/admin-deletion.spec.js` | a contributor with 2 recordings sends a deletion request; the admin finds them in Messages, deletes the recordings and marks it done; the profile shows 0 (C3) |
| `tests/admin-activity.spec.js` | a second admin (`admin2@signpak.test`, seeded as a normal account and promoted by the startup sync from `ADMIN_EMAILS`) and the first admin each add a category; Admin → Activity names the right admin for each, and shows the promotion by System (S7) |
| `tests/admin-export.spec.js` | a contributor makes two recordings (one trimmed and mirrored); the admin filters Admin → Submissions to their category and downloads the CSV, whose rows are exactly those submissions, with no name or email (B5) |
| `tests/contact.spec.js` | a signed-in contributor sends a contact message (C2); a signed-out deletion request is confirmed with the emailed code (D4) |
| `tests/csp.spec.js` | every path is served with the CSP and the security headers; an injected inline script is blocked and reported; the theme script and the sign-in photo still work under the CSP (S8) |
| `tests/admin-video-tool.spec.js` | the admin video tool removes a clip's sound with ffmpeg.wasm loaded from `/ffmpeg/`, nothing from a CDN, and the stored file has no audio track (S8) |
| `tests/accessibility.spec.js` | axe (WCAG 2.1 A/AA) finds no serious or critical problem on the landing, library, watch, editor and admin pages, in both themes (QA-20) |
| `tests/stale-chunks.spec.js` | A page chunk that answers 404 (as after a deploy) reloads the page once and the page opens; a chunk that stays missing shows "This page could not be loaded." after one reload, with no reload loop |

## Under the CSP

`vite preview` sends the production security headers (`frontend/config/securityHeaders.js`).
`support/test.js` makes every test fail if the browser reports a CSP violation (a
`securitypolicyviolation` event or a console message about one). A test that opens another
browser context calls `prepareContext(context)` on it. A test that triggers a violation on
purpose sets `test.use({ allowCspViolations: true })` and reads the `cspViolations` fixture.

Two browser limitations, both annotated in the report rather than skipped quietly: Playwright's
Windows WebKit build plays no video, so `admin-video-tool.spec.js` checks the tool's fallback
there (CI's Linux WebKit runs the full test); and the recording editor's axe check runs in
Chromium only, the one project with a fake camera.

The E2E API saves contact messages but never forwards them to Web3Forms, and raises the
per-sender deletion-request limit because every browser connects from 127.0.0.1.

Later phases add the rest of the list in `docs/FIX-PLAN.md` section 4.4 (login and lockout,
forgot password, record/trim/submit, admin flows and the CSV export).

Recording flows need a camera: the Chromium project runs with
`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, and Firefox and WebKit
run the flows that do not need one.

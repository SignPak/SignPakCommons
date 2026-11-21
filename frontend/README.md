# SignPak Commons: frontend

React 19 single-page application built with Vite, React Router, and Tailwind CSS
v4. It provides the public project pages, contributor recording workflow, and
admin workspace. The Express API owns accounts, categories, videos, and submitted
recordings; the browser keeps local preferences, a device ID, notifications,
and an unsubmitted recording draft.

## Run locally

Use Node.js 20.19+ (see `package.json` for the current engine requirement).

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
npm run lint
npm test          # unit + integration (Vitest)
npm run build
npm run preview   # serve the production build locally
```

Vite proxies `/api` to `http://localhost:5000` during development. Start the
backend separately, or set `VITE_API_ORIGIN` to another API origin.

## Routes

| Route | Access | Page |
| --- | --- | --- |
| `/` | Public | Landing page; about, contact, and policy are in-page sections. |
| `/demo` | Public | Walkthrough video. |
| `/faq` | Public | Frequently asked questions. |
| `/contact/verify?id=` | Public | Confirm a signed-out recording/data deletion request with the emailed six-digit code. |
| `/login`, `/signup` | Signed out | Sign in or register; redirects signed-in users. |
| `/verify-email`, `/signup/consent`, `/forgot-password` | Signed out | Email verification (the code plus the password chosen at sign-up), consent before account creation (survives a reload), and password recovery. |
| `/consent` | Signed in | Accept the current contributor notice; required for older accounts without current consent. |
| `/home` | Signed in with current consent | Category overview. |
| `/library/:categoryId` | Signed in | Videos in a category. |
| `/watch?v=:videoId` | Signed in | Watch a reference video and record a take. |
| `/watch/edit?v=:videoId` | Signed in | Review, trim, and submit the current take. |
| `/profile` | Signed in | Contribution history, profile connections, password change, and log out of all devices. |
| `/admin` | Admin | Admin dashboard. |
| `/admin/users` | Admin | Account controls, including deleting a contributor's recordings, or the account and its recordings together. |
| `/admin/videos` | Admin | Manage reference videos and the demo video. |
| `/admin/categories` | Admin | Manage categories. |
| `/admin/messages` | Admin | The contact inbox: filter messages, and act on a deletion request (find the contributor, delete their recordings, mark it done or rejected). |
| `/admin/activity` | Admin | The activity log: who did what and when, filtered by admin and action (S7). |

Route declarations live in `src/App.jsx`; shared path names and URL builders live
in `src/routes/appRoutes.js`. Auth guards in `src/components/RouteGuards.jsx`
redirect visitors who do not meet the route's access requirement and route
contributors without the current consent version through `/consent`.

Auth-shell forms use React Hook Form with Zod resolvers. Authentication
payloads are validated again in the API client, with backend Zod schemas as the
final validation boundary.

After email verification, the frontend holds the short-lived consent token in
the navigation state and offers accept or decline. Accepting creates and signs
in the account; declining discards the pending signup. The consent version and
acceptance timestamp are stored by the backend.

Contributors can delete their account from the profile after confirming their
current password. Account deletion removes sign-in access, but submitted
recordings and related contribution data remain stored. A separate
“Request recording/data deletion” topic on the home page contact form can be
used at any time before or after account deletion; it is available without
sign-in and asks for the account email. When sent signed out, the request is
confirmed with a six-digit code emailed to that account. Requests for an email
with no account any more are checked by the team by hand.
Recordings already used in a released model cannot be removed from that model.

When adding a base video, admins can upload a video file or provide a direct
HTTPS MP4/WebM file URL (watch-page links such as YouTube are not supported).
External videos require a JPEG, PNG, or WebP poster image (up to 2 MB). For
uploaded videos, admins can select a poster image or explicitly use a frame
captured automatically from the video.

## Backend connection

All HTTP requests go through `src/services/api.js`; endpoint paths are composed
in `src/services/apiRoutes.js`. Requests include credentials for the HTTP-only
session cookie, attach a browser device ID when available, unwrap the API's
`{ data }` success envelope, and surface server error messages and field errors.
JSON and multipart upload requests use the same request helper.

| Variable | Purpose |
| --- | --- |
| `VITE_API_ORIGIN` | API origin. Production: `https://api.commons.signpak.tech`. Empty by default; requests then use the Vite `/api` proxy locally. |
| `SITE_URL` | Public site origin for the sitemap, robots.txt and canonical links. Production: `https://commons.signpak.tech`. Not `VITE_`-prefixed because the Node SEO script reads it too; the build bakes the same value into the bundle. Unset means the production default, `https://commons.signpak.tech`; set it only for another deployment (e.g. staging). |
| `VITE_MAX_RECORDING_UPLOAD_MB` | Optional client-side recording size limit in MiB. Defaults to `100`; keep it equal to the backend's `MAX_RECORDING_UPLOAD_MB`. Recordings also stop automatically at 10 minutes, and the upload queue rejects any take exceeding either limit. |
| `VITE_SUBMISSION_COOLDOWN_MS` | Optional client countdown duration in milliseconds. Defaults to `30000`; the backend independently enforces its cooldown. |

Put local Vite variables in `frontend/.env.local` (do not commit secrets there).
Vite variables prefixed with `VITE_` are exposed in the browser bundle, so never
put credentials or private keys in them. Backend variables are documented in
[`../backend/.env.example`](../backend/.env.example).

Contributor recordings stay in memory as a `Blob` while the user moves between
the player and editor; closing the tab discards an unsubmitted take. On
submission, the frontend uploads the recording and trim/mirror metadata to the
backend. The backend validates and stores the recording and enforces the
submission cooldown. After submission, the recording uploads in the background:
one upload can run while one waits, and the contributor can continue browsing.
Failed uploads remain in the queue until retried or discarded. The queue is
memory-only, so the browser warns before a pending upload is lost; switching
accounts clears that account's queue.

Reference videos are downloaded into an in-memory cache for five minutes after
download completes, and the next video in the category is prefetched. Individual
videos larger than 100 MB bypass the cache, and cached entries are limited to
250 MB total; videos still playing are not revoked mid-playback.

Admins prepare reference and demo videos in the browser before upload: they can
remove audio and trim the clip, with processing performed
locally by ffmpeg.wasm when changes are applied. The browser also reports the
video's displayed dimensions and duration; the backend stores these values for
responsive playback and display. No video-processing worker is required on the
backend.

The ffmpeg.wasm core is loaded from jsDelivr on first use, so admins need network
access to that CDN to apply audio removal or trimming. If processing is
unavailable, the upload UI reports the failure and allows the original video to
be uploaded unchanged. Theme preference, device ID, and notifications are
stored locally in the browser; notifications are not synchronized between
devices.

## Structure

```text
src/
  App.jsx             Route tree and page composition
  main.jsx            Browser entry point and provider setup
  components/         Shared layouts, controls, navigation, and route guards
  config/             UI configuration
  context/            Auth, library, recording, upload queue, notification, and theme state
  hooks/              Reusable hooks, including camera/MediaRecorder handling
  pages/              Public and contributor pages
  pages/admin/        Admin workspace pages
  routes/             Client-side path names and URL builders
  services/           Backend API client and endpoint builders
  seo/                Static route SEO metadata and helpers
  styles/             Theme tokens and feature stylesheets
  utils/              Validation, media, and browser storage helpers
test/
  RecorderPanel.test.jsx  Recorder workflow component tests
docs/
  README.md           Documentation index
  ARCHITECTURE.md     Runtime, state, data flow, and deployment overview
  MODULE-REFERENCE.md Change-oriented map of frontend modules
  design-docs/        Architecture decisions and trade-offs
```

## Styling and themes

The app uses semantic component classes and CSS custom properties rather than
scattering colors through JSX. `src/index.css` imports the stylesheets in
`src/styles/`; theme tokens are defined in `src/styles/theme.css`.
`ThemeProvider` follows the operating-system preference until a user selects a
theme, then saves that choice in `localStorage`. An inline bootstrap in
`index.html` applies the theme before the first paint.

## SEO and prerendering

`src/seo/seoCatalog.mjs` is the source for static page metadata and the production
site URL: `https://commons.signpak.tech`, overridable with the `SITE_URL` environment
variable (e.g. for a staging deployment). The build runs
`npm run seo:generate` automatically to produce the sitemap, robots file, and
React Snap route list. After building, `npm run snap` can prerender those public
routes; it requires a working headless Chromium installation.

## Deployment

`vercel.json` rewrites direct route requests to the SPA entry point so refreshing
URLs such as `/admin/categories` loads the client router instead of returning a
host-level 404. The site is deployed on Vercel at `commons.signpak.tech` with `frontend/`
as its root, and the API runs on the team's own server at `api.commons.signpak.tech` (see
`deploy/README.md`). In the Vercel project set `VITE_API_ORIGIN=https://api.commons.signpak.tech` and
`SITE_URL=https://commons.signpak.tech`, then redeploy (both are read at build time). The two
hostnames are one site, so the API's `SameSite=Lax` login cookie works in every browser,
including Safari, iOS, Brave and private windows.

## Checks

The frontend package provides `npm run lint`, `npm test`, `npm run test:unit`,
`npm run test:integration`, `npm run test:coverage`, `npm run build`,
`npm run seo:generate`, and `npm run snap`.

`npm test` runs the Vitest suite in jsdom. `test/unit/` holds component, hook and
utility tests that mock `src/services/api` directly; `test/integration/` renders
whole pages with the real providers and API client and mocks only the network,
with MSW. `npm run test:coverage` enforces the thresholds in `vite.config.js`,
which may only be raised. Browser-level flows are covered by the Playwright suite
in `e2e/` at the repository root.

## Project model

SignPak Commons is a video data-collection tool: categories group reference
videos, and contributors can submit multiple recordings over time. A cooldown
prevents back-to-back submissions for the same contributor/video pair; it does
not mark a video as completed or prevent future takes.

See [the architecture guide](docs/ARCHITECTURE.md) for provider composition,
data ownership, URL conventions, and browser-local state.

# Frontend architecture

## Purpose and runtime

The frontend is a React 19 single-page application built with Vite, React Router,
and Tailwind CSS v4. It contains public information pages, authenticated
contributor workflows, and an admin workspace. The backend API is the source of
truth for accounts, categories, reference videos, and submitted recordings.

The frontend requires Node.js 20.19 or newer, as declared by
`package.json`. Its package scripts are `dev`, `lint`, `test`, `test:unit`,
`test:integration`, `test:coverage`, `build`, `preview`, `seo:generate`, and
`snap`. `npm test` runs Vitest in jsdom, with React component tests written using
Testing Library.

Tests are split by level. `test/unit/` covers utilities, hooks, providers and
single components, mocking `src/services/api`. `test/integration/` renders whole
pages with the real router, providers and API client, and mocks only HTTP with
MSW (`test/support/mswServer.js`). `npm run test:coverage` enforces the coverage
thresholds declared in `vite.config.js`. Full browser flows live in the
Playwright suite in `e2e/` at the repository root, which runs against the
production build served by `vite preview`; that preview proxies `/api` to the
end-to-end API, so the site and API share one origin.

## Bootstrap and providers

`src/main.jsx` mounts `src/App.jsx` inside `StrictMode`, `ThemeProvider`,
`BrowserRouter`, `AuthProvider`, `NotificationProvider`, `LibraryProvider`, and
`RecordingProvider`. This order lets the inner providers consume auth state and
lets route screens access the shared contexts.

`src/App.jsx` defines nested route groups and renders the shared `AppLayout`.
`src/routes/appRoutes.js` centralizes the path constants and URL builders:

- `categoryUrl(id)` builds `/library/:categoryId`.
- `watchUrl(id)` builds `/watch?v=:videoId`.
- `watchEditUrl(id)` builds `/watch/edit?v=:videoId`.

Video identity is carried in the query string so links do not depend on category
or display ordering. `/contact` and `/policy` redirect to sections on the landing
page; they are not separate page screens.

### Route access

`src/components/RouteGuards.jsx` implements three declarative access guards:

- `GuestOnly` allows signed-out visitors through auth pages and sends signed-in
  users to their original destination or `/home`.
- `RequireAuth` waits for the session check, redirects visitors to `/login`, and
  requires non-admin contributors to accept the current consent notice before
  accessing protected library and recording routes.
- `RequireAdmin` allows the admin role and otherwise redirects to `/home`.

The route tree includes public landing, demo, and FAQ pages; signed-out login,
signup, email verification, consent-before-account-creation, and password
recovery pages; a signed-in consent page for existing accounts; signed-in home,
library, watch, editor, and profile pages; and admin dashboard, user, video,
category and message pages.

**Admin → Messages** (`src/pages/admin/AdminMessages.jsx`, C3) lists contact messages
with filters for topic, status and verified. For a deletion request, **Find contributor**
calls `GET /admin/deletion-lookup?messageId=` (by message id, so the email never appears
in a URL) and lists the current account and any deleted account that used the email, each
with its recording count. **Delete recordings** confirms with that count, then calls
`DELETE /admin/users/:id/submissions?requestMessageId=`; a partial failure is shown and can
be retried. **Mark done**, **Reject** and **Reopen** set the message status. The badge reads
**Manual check** for an unverified request whose lookup finds no current account.
**Admin → Users** has **Delete recordings** and **Delete account and recordings** next to
**Delete**; every confirmation names the number of recordings, read from
`GET /admin/users/:id/submissions?limit=1`.

## State and ownership

React context providers coordinate shared state without an external state
management library.

| Provider | Responsibility and persistence |
| --- | --- |
| `AuthProvider` | Loads the current session from the API and exposes login, signup, email verification, consent completion/decline, logout, and connection updates. |
| `LibraryProvider` | Loads categories, visible videos, and the current user's submissions; provides derived category, contribution, and cooldown state plus admin mutations. |
| `RecordingProvider` | Holds unsubmitted recording blobs and trim/mirror edits in memory, keyed by video ID. These drafts are discarded on submit, replacement, user change, or tab close. |
| `UploadQueueProvider` | Holds up to two submitted recordings in an in-memory queue (one uploading and one waiting). Failed uploads keep their slot for retry or discard; the queue is cleared when the signed-in user changes. |
| `NotificationProvider` | Stores per-user notification items and read state in browser `localStorage`; notifications do not sync across devices. |
| `ThemeProvider` | Follows the OS theme until a user selects one, then persists the selection locally. |

Browser-local data is limited to preferences, the generated device ID, local
notifications, and the active unsubmitted recording draft. The backend owns
persistent account, library, and submission data.

## API and data flow

`src/services/api.js` is the HTTP client and `src/services/apiRoutes.js` builds
endpoint URLs. Pages and providers use the service methods rather than calling
`fetch` directly.

The client:

- Adds `credentials: 'include'` so the HTTP-only `signpak_token` cookie is sent.
- Sends `X-Device-ID` when browser storage is available.
- Sends JSON for structured requests and `FormData` for video uploads.
- Returns the backend's `data` envelope value and throws errors containing the
  server message, status, and field-level validation messages.
- Converts API-relative media URLs to absolute URLs when `VITE_API_ORIGIN` is
  configured.
- Uses shared Zod schemas to validate authentication form input and validates
  authentication request payloads again at the API-client boundary. Backend
  Zod validation remains authoritative.

Email verification returns a short-lived consent token rather than a session.
The verify page sends the password chosen at sign-up with the code (B3), so only the
person who set the latest password can finish a sign-up. The token is kept in
`sessionStorage` by `src/utils/consentTokenStore.js` (B4), with its own expiry, so
reloading the consent page doesn't lose it; accepting or declining clears it. The
signup consent screen submits that token and the current notice version; only
successful acceptance activates and signs in the new account. Declining discards the
pending signup.

**Profile → Security** (`src/components/AccountSecurity.jsx`) changes the password
while logged in (every other session ends, this one stays) and offers **Log out of
all devices**. Since Phase 6 every logout ends the account's sessions on all devices
(S6). Five wrong passwords lock an account for 15 minutes; the login page shows the
server's message. Existing contributors without the current consent
version are routed to `/consent` before using protected contributor pages.

Vite proxies `/api` to `http://localhost:5000` for local development. The
optional `VITE_API_ORIGIN` variable selects a separately hosted API; leave it
empty when using the local proxy. `VITE_SUBMISSION_COOLDOWN_MS` sets the UI's
countdown duration and defaults to 30,000 ms. This countdown is only a user
interface hint; the backend independently enforces the cooldown.

### Recording flow

`useRecorder` captures camera and microphone media through browser media APIs.
The `RecordingProvider` keeps the current take available while a contributor
moves between `/watch` and `/watch/edit`. The editor applies trim and mirror
settings as submission metadata, then hands the recording blob and metadata to
`UploadQueueProvider`. Uploads run one at a time through an XMLHttpRequest so
the UI can report byte progress and abort on account changes. The editor returns
to the player immediately; a page-level toaster reports waiting, active, failed,
and completed uploads. Failed uploads retain their queue slot until retried or
discarded. Queue data is memory-only, and a `beforeunload` prompt warns if the
tab is closed or reloaded while work remains. The backend stores contributor
recordings and metadata; it does not physically trim or transcode them. The
per-video cooldown starts when the server accepts an upload for processing, and
the API's `cooldownStartedAt` timestamp drives the matching client countdown.

### Reference-video cache

`useCachedVideo` loads reference videos into an in-memory Blob cache and falls
back to the normal media URL if the download fails or exceeds the per-video
100 MB cap. Entries expire five minutes after download and the cache evicts
oldest entries to stay within a 250 MB total budget. A player holds its entry
while it is in use so an expired or evicted object URL is not revoked during
playback. The player also prefetches the next video in its category after the
current video's load attempt finishes. The player keeps one `<video>` element
mounted when switching videos, resetting playback state before it loads the
next source. External direct HTTPS video URLs use this same cache when the
source allows browser CORS; otherwise playback falls back to the source URL.
External watch pages (such as YouTube pages) are not supported.

### Admin video preparation and responsive playback

Before uploading reference or demo videos, admins use `VideoPrep` to preview the
local file, optionally remove audio, and trim its start and end. When processing
is needed, `processVideo` loads ffmpeg.wasm on demand and processes the file in
the browser; trimming re-encodes the selected range, while audio-only removal
copies the video stream. No processing happens on the backend. The core is
downloaded from jsDelivr on first use, so the browser needs network access to
that CDN to apply changes. If processing fails, the UI reports the error and
allows an unchanged original upload.

`inspectVideoFile` reads the browser-reported duration and displayed dimensions
(including rotation metadata) and captures a poster frame locally. For each
reference video, admins must either select a JPEG, PNG, or WebP poster image
(up to 2 MB), or check the option to use that captured frame. The upload stores
`durationSec`, `width`, and `height` with the video; unknown dimensions are
represented as zero. `ResponsiveVideo` uses stored dimensions to size the
frame before media metadata loads, then prefers the dimensions reported by the
loaded video. This keeps portrait, square, and landscape videos in their native
aspect ratio while fitting the player layout.

Admins can also register a direct HTTPS video URL rather than uploading the
video bytes. The URL is stored with the video record in MongoDB; its poster
image is uploaded through the configured storage driver (Google Drive when
`STORAGE_DRIVER=gdrive`). Upstash Redis caches poster file metadata for five
minutes, while the poster endpoint streams image bytes from storage and sends a
matching five-minute browser cache header. Redis stores metadata, not image
bytes.

Contributors can delete their account from the profile after confirming their
password; submitted recordings and contribution data are retained. The public
contact form (`src/components/ContactForm.jsx`, on the landing page) accepts a
dedicated recording/data deletion topic without sign-in at any time, including
after account deletion. Signed-out visitors see only that topic; signed-in
contributors also see General inquiry and Partnership. Data already incorporated
into a released model cannot be removed from that model.

A signed-out deletion request goes on to `/contact/verify?id=<message id>`
(`src/pages/ContactVerify.jsx`), where the sender enters the six-digit code
emailed to the account; a new code can be requested once a minute. The page never
says whether an account exists: a sender with no account is told the team will
check the request by hand. A signed-in request needs no code.

The landing page is public, so no route guard loads the session there. It calls
`ensureSession()` itself, and the contact form keeps its send button disabled until
the session is known, so a signed-in contributor always gets the signed-in form.

## UI and styling

`src/components/` holds shared layouts, navigation, form fields, buttons,
dialogs, notifications, and route guards. `src/pages/` contains route-level
screens; `src/pages/admin/` contains the admin workspace.

`src/index.css` imports feature stylesheets from `src/styles/`. Components
primarily use semantic selectors and shared theme tokens. `theme.css` defines
light and dark CSS custom properties. `ThemeProvider` applies the active theme
to the document root, while an inline bootstrap in `index.html` selects the
saved or OS preference before the first paint.

## SEO and prerendering

`src/seo/seoCatalog.mjs` is the source for static route metadata and the
canonical site URL. Only indexable entries in the catalog are included in the
sitemap and React Snap route list; entries marked `noindex` are excluded. The site URL
comes from the `SITE_URL` environment variable: the Node SEO script reads it directly, and
`vite.config.js` bakes the same value into the bundle as `__SITE_URL__`. Unset, it is the
production site, `https://commons.signpak.tech` (decision D2).

`npm run seo:generate` writes the sitemap, robots file, and
`react-snap-routes.json`; it runs as part of `npm run build`. `npm run snap`
prerenders the generated public route list into `dist/` and requires the built
site plus an available headless Chromium executable.

## Hosting and client-side routing

The Vite development server provides the `/api` proxy. For Vercel, `vercel.json`
rewrites application routes to `/` so that direct navigation or a reload on a
client-side route such as `/admin/categories` serves the SPA entry point. When
In production the site is `commons.signpak.tech` (Vercel) and the API is `api.commons.signpak.tech` (the
team's server): different origins but the same site, so the API's host-only `SameSite=Lax`
cookie is sent on the site's credentialed requests. Set `VITE_API_ORIGIN=https://api.commons.signpak.tech`
in the Vercel build environment, and the backend's `CLIENT_ORIGIN` to the site origin.
`e2e/tests/cross-host-cookie.spec.js` reproduces this layout with `commons.localtest.me` and
`api.localtest.me`.

## Project map

```text
frontend/
  src/
    App.jsx                 # Route tree and page composition
    main.jsx                # Browser entry and provider nesting
    components/             # Shared layout and UI pieces
    config/                 # UI configuration
    context/                # Shared state providers and contexts
    hooks/                  # Reusable UI and media hooks
    pages/                  # Public and contributor screens
    pages/admin/            # Admin screens
    routes/                 # Client-side paths and URL builders
    services/               # API client and endpoint builders
    seo/                    # SEO metadata and helpers
    styles/                 # Theme tokens and feature styles
    utils/                  # Shared browser and media utilities
    docs/
      architecture.md       # This guide
  test/
    RecorderPanel.test.jsx  # Recorder workflow component tests
  scripts/
    generateSeoAssets.js    # Sitemap, robots, and prerender route generation
    runReactSnap.js         # Static route prerendering
```

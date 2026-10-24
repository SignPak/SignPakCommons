# Frontend architecture

## Purpose and runtime

The frontend is a React 19 single-page application built with Vite, React Router,
and Tailwind CSS v4. It contains public information pages, authenticated
contributor workflows, and an admin workspace. The backend API is the source of
truth for accounts, categories, reference videos, and submitted recordings.

The frontend requires Node.js 20.19 or newer, as declared by
`package.json`. Its package scripts are `dev`, `lint`, `test`, `build`,
`preview`, `seo:generate`, and `snap`. `npm test` runs Vitest in jsdom, with
React component tests written using Testing Library.

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
library, watch, editor, and profile pages; and admin dashboard, user, video, and
category pages.

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
The signup consent screen submits that token and the current notice version;
only successful acceptance activates and signs in the new account. Declining
discards the pending signup. Existing contributors without the current consent
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
contact form accepts a dedicated recording/data deletion topic without sign-in
at any time, including after account deletion. Requests sent after deletion may
require the team to verify and manually match the former contributor. Data
already incorporated into a released model cannot be removed from that model.

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
sitemap and React Snap route list; entries marked `noindex` are excluded. Set
`SITE_URL` to the deployed frontend origin before generating production SEO
assets.

`npm run seo:generate` writes the sitemap, robots file, and
`react-snap-routes.json`; it runs as part of `npm run build`. `npm run snap`
prerenders the generated public route list into `dist/` and requires the built
site plus an available headless Chromium executable.

## Hosting and client-side routing

The Vite development server provides the `/api` proxy. For Vercel, `vercel.json`
rewrites application routes to `/` so that direct navigation or a reload on a
client-side route such as `/admin/categories` serves the SPA entry point. When
the frontend and API are deployed on different origins, configure
`VITE_API_ORIGIN` in the frontend build environment and set the backend's
`CLIENT_ORIGIN` to the frontend origin. Cross-site session cookies require HTTPS
and compatible backend cookie settings.

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

# Frontend architecture

## Purpose and runtime

The frontend is a React 19 single-page application built with Vite, React Router,
and Tailwind CSS v4. It contains public information pages, authenticated
contributor workflows, and an admin workspace. The backend API is the source of
truth for accounts, categories, reference videos, and submitted recordings.

The frontend requires Node.js 20.19 or newer, as declared by
`package.json`. Its package scripts are `dev`, `lint`, `build`, `preview`,
`seo:generate`, and `snap`; there is no frontend test script.

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
- `RequireAuth` waits for the session check and redirects visitors to `/login`.
- `RequireAdmin` allows the admin role and otherwise redirects to `/home`.

The route tree includes public landing, demo, and FAQ pages; signed-out login,
signup, email verification, and password recovery pages; signed-in home, library,
watch, editor, and profile pages; and admin dashboard, user, video, and category
pages.

## State and ownership

React context providers coordinate shared state without an external state
management library.

| Provider | Responsibility and persistence |
| --- | --- |
| `AuthProvider` | Loads the current session from the API and exposes login, signup, email verification, logout, and connection updates. |
| `LibraryProvider` | Loads categories, visible videos, and the current user's submissions; provides derived category, contribution, and cooldown state plus admin mutations. |
| `RecordingProvider` | Holds unsubmitted recording blobs and trim/mirror edits in memory, keyed by video ID. These drafts are discarded on submit, replacement, user change, or tab close. |
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

Vite proxies `/api` to `http://localhost:5000` for local development. The
optional `VITE_API_ORIGIN` variable selects a separately hosted API; leave it
empty when using the local proxy. `VITE_SUBMISSION_COOLDOWN_MS` sets the UI's
countdown duration and defaults to 30,000 ms. This countdown is only a user
interface hint; the backend independently enforces the cooldown.

### Recording flow

`useRecorder` captures camera and microphone media through browser media APIs.
The `RecordingProvider` keeps the current take available while a contributor
moves between `/watch` and `/watch/edit`. The editor applies trim and mirror
settings as submission metadata, then uploads the recording blob and metadata
through the API service. The backend stores the uploaded recording and metadata;
it does not physically trim or transcode the file.

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
    ARCHITECTURE.md         # This guide
  scripts/
    generateSeoAssets.js    # Sitemap, robots, and prerender route generation
    runReactSnap.js         # Static route prerendering
```

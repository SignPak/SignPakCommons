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
| `/login`, `/signup` | Signed out | Sign in or register; redirects signed-in users. |
| `/verify-email`, `/forgot-password` | Signed out | Email verification and password recovery. |
| `/home` | Signed in | Category overview. |
| `/library/:categoryId` | Signed in | Videos in a category. |
| `/watch?v=:videoId` | Signed in | Watch a reference video and record a take. |
| `/watch/edit?v=:videoId` | Signed in | Review, trim, and submit the current take. |
| `/profile` | Signed in | Contribution history and profile connections. |
| `/admin` | Admin | Admin dashboard. |
| `/admin/users` | Admin | Account controls. |
| `/admin/videos` | Admin | Manage reference videos and the demo video. |
| `/admin/categories` | Admin | Manage categories. |

Route declarations live in `src/App.jsx`; shared path names and URL builders live
in `src/routes/appRoutes.js`. Auth guards in `src/components/RouteGuards.jsx`
redirect visitors who do not meet the route's access requirement.

## Backend connection

All HTTP requests go through `src/services/api.js`; endpoint paths are composed
in `src/services/apiRoutes.js`. Requests include credentials for the HTTP-only
session cookie, attach a browser device ID when available, unwrap the API's
`{ data }` success envelope, and surface server error messages and field errors.
JSON and multipart upload requests use the same request helper.

| Variable | Purpose |
| --- | --- |
| `VITE_API_ORIGIN` | Optional API origin, e.g. `https://api.example.com`. Empty by default; requests use the Vite `/api` proxy locally. |
| `VITE_SUBMISSION_COOLDOWN_MS` | Optional client countdown duration in milliseconds. Defaults to `30000`; the backend independently enforces its cooldown. |

Put local Vite variables in `frontend/.env.local` (do not commit secrets there).
Vite variables prefixed with `VITE_` are exposed in the browser bundle, so never
put credentials or private keys in them. Backend variables are documented in
[`../backend/.env.example`](../backend/.env.example).

Contributor recordings stay in memory as a `Blob` while the user moves between
the player and editor; closing the tab discards an unsubmitted take. On
submission, the frontend uploads the video and trim/mirror metadata to the
backend. The backend validates and stores the recording and enforces the
submission cooldown. Theme preference, device ID, and notifications are stored
locally in the browser; notifications are not synchronized between devices.

## Structure

```text
src/
  App.jsx             Route tree and page composition
  main.jsx            Browser entry point and provider setup
  components/         Shared layouts, controls, navigation, and route guards
  config/             UI configuration
  context/            Auth, library, recording, notification, and theme state
  hooks/              Reusable hooks, including camera/MediaRecorder handling
  pages/              Public and contributor pages
  pages/admin/        Admin workspace pages
  routes/             Client-side path names and URL builders
  services/           Backend API client and endpoint builders
  seo/                Static route SEO metadata and helpers
  styles/             Theme tokens and feature stylesheets
  utils/              Validation, media, and browser storage helpers
docs/
  ARCHITECTURE.md     Runtime, state, data flow, and deployment overview
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
site URL. Replace its placeholder `SITE_URL` before deployment. The build runs
`npm run seo:generate` automatically to produce the sitemap, robots file, and
React Snap route list. After building, `npm run snap` can prerender those public
routes; it requires a working headless Chromium installation.

## Deployment

`vercel.json` rewrites direct route requests to the SPA entry point so refreshing
URLs such as `/admin/categories` loads the client router instead of returning a
host-level 404. Configure the frontend build with `frontend/` as its root when
deploying this app separately, set `VITE_API_ORIGIN` for a separately hosted
backend, and configure the backend's `CLIENT_ORIGIN` to the exact frontend
origin. API cookies require compatible HTTPS and cookie settings.

## Checks

The frontend package currently provides `npm run lint`, `npm run build`,
`npm run seo:generate`, and `npm run snap`. It does not define an automated
frontend test script.

## Project model

SignPak Commons is a video data-collection tool: categories group reference
videos, and contributors can submit multiple recordings over time. A cooldown
prevents back-to-back submissions for the same contributor/video pair; it does
not mark a video as completed or prevent future takes.

See [the architecture guide](docs/ARCHITECTURE.md) for provider composition,
data ownership, URL conventions, and browser-local state.

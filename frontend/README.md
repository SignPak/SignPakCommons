# SignPakCommons: frontend

React 19 + Vite + Tailwind CSS v4 + React Router. The frontend uses the Express + MongoDB backend through `src/services/api.js`.

## Run it

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

## Routes

| Path                        | Who        | What                                             |
| --------------------------- | ---------- | ------------------------------------------------ |
| `/`                         | public     | Landing: hero, about, policy, contact            |
| `/demo`                     | public     | "How it works" walkthrough video                 |
| `/signup`, `/login`         | logged out | Account forms                                    |
| `/verify-email`             | logged out | Verify signup code sent by email                 |
| `/forgot-password`          | logged out | Request a code and reset password                |
| `/home`                     | learner    | Categories                                       |
| `/library/:categoryId`      | learner    | Videos in a category (search, filter, sort)      |
| `/watch?v=<videoId>`        | learner    | Player and recorder                              |
| `/watch/edit?v=<videoId>`   | learner    | Review, trim, submit                             |
| `/profile`                  | learner    | Progress, submissions, GitHub / LinkedIn         |
| `/admin`                    | admin      | Dashboard                                        |
| `/admin/videos`             | admin      | Upload, preview, edit, publish, delete           |
| `/admin/categories`         | admin      | Create categories, assign videos                 |

## Folder layout

src/
  components/   shared UI (Header, Footer, Field, players, route guards)
  context/      Auth, Library and Recording state
  hooks/        useRecorder (camera + MediaRecorder)
  config/       production constants used by the UI
  pages/        one file per screen, admin/ for the workspace
  services/     api.js: the only file that talks to "the server"
  styles/       all styling; index.css just imports these
  utils/        formatting, validation, IndexedDB and video helpers

## Styling

No inline utility classes in JSX. Components use semantic class names (`.btn`, `.lesson-card`, `.recorder`...) defined in `src/styles/*.css` with Tailwind's `@apply`. Colours and fonts are tokens in `styles/theme.css`, so a palette change is one file.

## Backend integration

Every server call goes through `src/services/api.js`. Requests use the `/api/v1` backend routes, include the HTTP-only session cookie, unwrap the `{ data }` response envelope, and support multipart video and recording uploads.

- Set `VITE_API_ORIGIN` when the deployed frontend and backend use different origins. Leave it empty during local development to use the Vite `/api` proxy.
- Backend environment values are documented in `../backend/.env.example`.
- Admin video uploads are stored by the backend; the browser does not keep the base library in IndexedDB.
- Recording submissions upload the recorded `Blob` with trim metadata. The backend enforces the submission cooldown.
- Notifications remain browser-local until a persisted backend notification API is added.
- Signup requires a Brevo-delivered email code before the API establishes a session; password recovery uses a separate one-time code.

## Theming

Light and dark, both derived from the same analogous palette (deep green → turquoise → cyan), with white for contrast text. All app colours are CSS custom properties in `src/styles/theme.css`: one block of values for light, one for dark under `:root[data-theme='dark']`. Components never use raw hex; they use semantic Tailwind tokens (`bg-page`, `text-heading`, `border-line`...) that resolve to whichever theme is active, so a look change only ever touches `theme.css`.

- **Switching:** the header's sun/moon button, powered by `context/ThemeProvider.jsx`. Before a person picks, the theme follows their OS setting (`prefers-color-scheme`) and keeps following it live. Once they click the toggle, that choice is saved to `localStorage` and wins from then on, on every page, until they change it again.
- **No flash on load:** a small inline script in `index.html` reads the saved theme (or the OS setting) and sets it on `<html>` before the page paints, before React runs.
- **Cyan needed help:** `#0096FF` alone is only ~3.1:1 against white, below the 4.5:1 that body text needs, so it's used for large accents (focus rings, chart lines, gradients) and for the `--accent-ink` shade instead, a deeper blue in light mode and a lighter one in dark mode, both checked at 4.5:1+. Every text/background pair in both themes was checked against WCAG AA; running `node e2e/audit.mjs`-style checks (see below) currently reports zero contrast violations across all 14 screens × 2 themes.

## Fonts

Google Fonts, loaded in `index.html`:

- **Barlow Condensed** (600/700) — headlines and big numbers (`.display`)
- **Quicksand** (500/600/700) — buttons, labels, nav, anything UI chrome (`font-ui`)
- **Inter** (400–700) — body copy, the readable default

## Verifying this yourself

This redesign was checked, not just eyeballed:

- **axe-core** ran against all 14 pages/states in both themes: 0 accessibility violations (contrast, labels, roles).
- The existing 74-check Playwright journey suite (signup → record → trim → submit → admin) still passes after the restyle.
- 26 additional checks cover theme switching (OS-follow, persistence, no-flash-on-load, keyboard operation) and font loading.
- A phone-width (375px) sweep confirmed no page causes horizontal scroll.

These checks used local test scripts, not shipped in this codebase.

## Data collection, not a course

This is a video **data-collection** tool, not a learning platform: there's no curriculum, no "complete this lesson," nothing to finish. Terminology reflects that throughout — a **category** groups **videos** by topic, and a **contributor** can record any video as many times as they like.

**Recording again — the 30-second cooldown.** A contributor can submit more than one recording for the same video, but not back-to-back. The Player UI shows a countdown, and the backend atomically enforces the same cooldown through `SUBMISSION_COOLDOWN_MS`.

## Routing

- **`src/routes/appRoutes.js`** — every client-side path the app links to, plus builders for the ones that take an id (`watchUrl(id)`, `watchEditUrl(id)`, `categoryUrl(id)`). Components import from here rather than writing `` `/watch?v=${id}` `` inline.
- **A video's address is `/watch?v=<id>`**, not `/lesson/<id>` — the same shape YouTube uses. A query parameter keeps a video's URL independent of anything else about it (which category it's in, its position in a list), so links stay valid even if the catalog is reorganised. Editing a take is `/watch/edit?v=<id>`.
- **`src/services/apiRoutes.js`** — the real backend's endpoint paths (from `backend/README.md`), collected in one file for when `services/api.js` stops using `localStorage` and starts calling Express. Nothing imports this yet; it's ready for that day.

## SEO

- **`src/seo/seoCatalog.mjs`** — the list of static, public routes worth a search engine's time (home, demo, FAQ; login/signup/profile are listed but marked `noindex` since they're per-user or auth-only). Update `SITE_URL` here before deploying — it's currently a placeholder.
- **`src/seo/seoUtils.js`** — a `useSeo(path)` hook that sets the page title, meta description and canonical link from the catalog. Called once per static page (see `Landing.jsx`, `Demo.jsx`, `Faq.jsx`).
- **`npm run seo:generate`** (`scripts/generateSeoAssets.js`) reads the catalog and writes `public/sitemap.xml`, `public/robots.txt` and `react-snap-routes.json`. It runs automatically before `npm run build`, so Vite copies the generated assets into `dist/`. These local production outputs are ignored by Git; update `src/seo/seoCatalog.mjs` instead.
- **`npm run snap`** (`scripts/runReactSnap.js`) prerenders those same routes to static HTML with `react-snap`, so the built `dist/` has real markup instead of an empty `<div id="root">` for search engines and no-JS clients. Run `npm run build` first. Not part of `postbuild` — it needs headless Chromium and is slow, so it's a separate, manual step. This was tested end-to-end in a sandbox with no real network access: `react-snap` bundles an old Puppeteer (1.20.0, from ~2019) whose own Chromium download was skipped in favour of pointing `PUPPETEER_EXECUTABLE_PATH` at an already-installed Chromium, plus `--no-sandbox` (needed because the whole container runs as root). None of that should be necessary on a normal machine or CI runner with regular internet access; a plain `npm install && npm run build && npm run snap` should just work. One thing worth knowing: `react-snap` bundles a genuinely old, unmaintained Puppeteer with known CVEs in its own dependency tree (`npm audit` will flag it) — that's a property of the tool itself, not something this integration adds on top of it.

## FAQ

`/faq` (`src/pages/Faq.jsx`), a plain accordion (native `<details>`/`<summary>`, no extra JS) answering real questions about contributing: what the project is, whether it's a course (it isn't), the cooldown, privacy of recordings, and who is behind it. Linked from the header for both visitors and contributors.

## Notifications

The bell in the header (`components/NotificationBell.jsx`, `context/NotificationProvider.jsx`) is browser-local and survives a reload. Cross-device notification persistence requires a future backend notification API.

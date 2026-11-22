# Phase 9 – Frontend hardening and clean-up (S8, S10, leftovers)

## Phase and branch

| | |
| --- | --- |
| Phase | 9 – Frontend hardening and clean-up (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-9-frontend-hardening` (from `main` @ `6111914`, Phase 8 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.14 → 1.0.15`, frontend `1.0.16 → 1.0.17` |

## Checklist items

| Item | Status | Summary |
| --- | --- | --- |
| S8 | **Fixed, ticked** | A CSP and three other security headers in `vercel.json` and `vite preview`. The ffmpeg core is served by the site from `/ffmpeg`. Every E2E test runs under the CSP. |
| S10 | **Fixed, ticked** | `X-Request-Id` is kept only if it matches `^[A-Za-z0-9-]{1,64}$`. The `X-Device-ID` weakness is documented. |
| Leftover: unused `blobStore.js` | **Ticked** | Removed. Keeping notifications per browser is the settled decision, now also in `MODULE-REFERENCE.md`. |
| Leftover: main bundle 526 KB | **Ticked** | Main chunk **268.37 kB** (it was 560.03 kB). CI fails above 300 kB. |
| FIX-PLAN item 5: react-snap | **Done** | Removed. The full frontend audit drops from 23 advisories (14 high, 3 critical) to 3 moderate (eslint). |
| FIX-PLAN item 6: accessibility | **Done** | axe finds no serious or critical problem in either theme. Four problems were fixed (below). |
| Added before hand-off: stale chunks after a deploy | **Done** | A tab opened before a deploy reloads once when an old page chunk is gone, and shows an error (no loop) if it is still missing. |

## Your decisions

In planning:
1. **ffmpeg core:** copied at build time from a pinned `@ffmpeg/core@0.12.10` dependency into a
   gitignored `public/ffmpeg/`. No 32 MB binary in git.
2. **The Unsplash sign-in photo** is self-hosted (`public/images/auth-background.jpg`).
3. **External reference videos** are never fetched for the browser cache. They play straight
   from their host.
4. **If needed, more pages are lazy-loaded** to reach 300 kB, with no vendor-chunk tricks.

During the work (asked when lazy pages weren't enough):

5. **Zod loads with its schemas.** With every page but the landing page lazy, the main chunk was
   still 355 kB: react-dom 207 kB, **Zod 84 kB**, app code about 60 kB. Zod was eager only
   because `api.js` imported the request schemas. It now loads them the first time it validates
   an input, which gives 266.70 kB.

## Claims checked against the code first

**What the planned CSP would have broken.** Each one was fixed:
- **The inline theme script** in `index.html`. A hash wouldn't work either: the CRLF and LF
  checkouts give different hashes.
- **ffmpeg's core from jsDelivr,** passed to the worker as a `blob:` URL.
- **`fetch('data:…')`** for the auto-generated poster.
- **`fetch` of external videos** for the cache.
- **The Unsplash photo.**
- **Zod 4's `new Function` probe.**
- **The cross-host E2E build's** different API origin.

**Already done, or smaller than FIX-PLAN assumed:**
- **Notifications:** the "per browser" note was already in `frontend/README.md` and
  `docs/architecture.md`.
- **ffmpeg's JS** was already a lazy chunk.
- **`main.jsx`** uses `createRoot`, not hydration, so removing react-snap needed no entry-point
  change.
- **Request ids:** nothing tested them before.

## What changed

### S8: security headers and CSP
- **`frontend/config/securityHeaders.js`** builds the headers for a given API origin:
  - the CSP, exactly as FIX-PLAN lists it: `default-src 'self'`, `script-src 'self'
    'wasm-unsafe-eval'`, `connect-src`/`img-src`/`media-src` with the API, `frame-ancestors
    'none'`, and so on;
  - `Referrer-Policy`, `X-Content-Type-Options` and `Permissions-Policy: camera=(self),
    microphone=(), geolocation=()`.
- **`vercel.json`** sends them on `/(.*)`, which also covers the ffmpeg worker script.
- **`vite.config.js`** `preview.headers` sends the same set, for `VITE_API_ORIGIN` or the
  production API. The dev server sends no CSP (Vite injects inline styles and HMR).
- **Code changed so the CSP needs no exceptions:**
  - `public/theme-init.js` is the old inline theme script, unchanged, loaded as a blocking
    `<script src>`.
  - `src/utils/zod.js` sets `z.config({ jitless: true })`. Every schema module imports Zod from
    it, and a unit test checks that none imports `zod` directly.
  - `src/utils/dataUrl.js` (`dataUrlToBlob`) replaces `fetch(dataUrl)` for posters.
  - `isCacheableVideoUrl` in `src/utils/videoCache.js` fetches into the cache only from the site
    or the API. An external video rejects with `EXTERNAL`, and the player streams it, as it
    already did when caching failed.
  - The sign-in photo is `public/images/auth-background.jpg`.

### ffmpeg from `/ffmpeg`
- **`@ffmpeg/core`** `0.12.10` (2025-01-07) is pinned exactly and was installed with npm 10 and
  `--before=2026-11-08`.
- **`scripts/copyFfmpegCore.js`** (`npm run ffmpeg:copy`, run by `prebuild` and `predev`) copies
  `ffmpeg-core.js` (112 kB) and `ffmpeg-core.wasm` (32.2 MB) into `public/ffmpeg/`, which is
  gitignored.
- **`processVideo.js`** passes same-origin `/ffmpeg/…` URLs instead of `toBlobURL`. That made
  `@ffmpeg/util` unused, so it is removed too. jsDelivr appears nowhere.

### S10: `X-Request-Id`
- **`backend/src/utils/requestId.js`:** `requestIdFrom(header)` keeps a string matching
  `^[A-Za-z0-9-]{1,64}$`, else returns `randomUUID()`. `app.js` `genReqId` uses it.
- **`X-Device-ID`:** no code change. `ARCHITECTURE.md` says it is client-made, so the IP
  restriction is the real control.
- **Docs:** `docs/API.md` and the OpenAPI description.

### Bundle size
- **`App.jsx`:** every page except `Landing` uses `React.lazy`. `AppLayout` and `AdminLayout`
  wrap their `<Outlet>` in `<Suspense>`, with a "Loading…" status line, so the header and the
  admin tabs stay while a page loads.
- **`api.js`** loads the three schema modules with one cached dynamic `import()` the first time
  it validates. A failed load is retried on the next call.
- **The admin export link** has to be built synchronously (it's an `href`), so it moved from
  `api.admin.exportUrl` to `src/services/adminExport.js` (`adminExportUrl`). Only the lazy
  Submissions page imports it.
- **`scripts/checkBundleSize.js`** (`npm run check:bundle`) finds the entry chunk in
  `dist/index.html` and fails above 300,000 bytes. CI runs it after the build.

| | Main chunk |
| --- | --- |
| Before | 560.03 kB |
| Admin pages and editor lazy | 447.37 kB |
| Every page but landing lazy | 355.36 kB |
| Zod with its schemas | 266.70 kB |
| With the stale-chunk handler and error boundary (final) | **268.37 kB** |

### Stale chunks after a deploy (added before hand-off, as you asked)

Lazy pages have hashed chunk names, and a Vercel deploy removes the old ones. A tab opened
before the deploy then gets "Failed to fetch dynamically imported module" on its next new page.

- **`src/utils/chunkReload.js`,** installed first in `main.jsx`, handles Vite's
  `vite:preloadError` event (Vite 8 fires it for a failed dynamic import as well as a failed
  preload; checked in the built preload helper):
  - **First failure:** `event.preventDefault()`, then `location.reload()` once, so the new build
    is fetched. The time goes into sessionStorage (`signpak:chunk-reload-at`).
  - **Loop guard:** another failure within 10 s of that reload is let through. It also never
    reloads twice from the same page.
  - **Blocked sessionStorage:** every access is in `try`/`catch`; the page still reloads once.
  - **Leaving the page:** a failure in the 3 s after `beforeunload` is ignored, and `pageshow`
    (back/forward cache) clears that. The first full E2E run found this: Firefox aborts the old
    page's pending imports as soon as a navigation or reload starts, which fires
    `vite:preloadError`, and the reload then cancelled the navigation (`NS_BINDING_ABORTED` in
    four Firefox tests: B4, S7, B5 and C4). A visitor who clicked away while a page was loading
    would have been pulled back. With the fix those four pass, and so does every other test.
- **The error UI:** the app had none (an error in a lazy page blanked the whole app), so
  **`components/PageErrorBoundary.jsx`** is new. It wraps the `<Suspense>` in `AppLayout` and
  `AdminLayout` and shows "This page could not be loaded. Reload to try again." with a Reload
  button.
  - The header (and the admin tabs) stay.
  - Going to another page clears the error.
  - While a reload for a new build is pending, it shows the loading line instead of flashing the
    error.
  - It is a `<section role="alert">` with an `<h2>`, not `PageState`'s `<main>`, because in the
    admin workspace it sits inside the layout's `<main>`.
- **`PageLoading`** moved to `components/PageLoading.jsx` (still exported from `Layouts.jsx`), so
  the boundary can use it without a circular import.

### Clean-up
- **react-snap is gone, exactly as FIX-PLAN lists:**
  - the devDependency (lockfile regenerated with npm 10) and the `snap` script;
  - `scripts/runReactSnap.js`;
  - the `react-snap-routes.json` write and header in `generateSeoAssets.js`, the line in
    `seoCatalog.mjs`, and its `.gitignore` line;
  - the docs paragraphs and file-tree lines;
  - the CI audit comment.
- **Checks after the removal:**
  - `npm ls react-snap mkdirp minimist` is empty.
  - The full audit lists only `eslint`, `@eslint/config-array` and `minimatch` (moderate).
- **SEO output:**
  - `robots.txt` is byte-identical to before.
  - `sitemap.xml` is identical apart from `<lastmod>`, which is the generation time on every
    build.
- **`src/utils/blobStore.js`** is deleted (it had no importers).

### Accessibility (axe)

`@axe-core/playwright` 4.14.0 (2026-10-15, npm 10, `--before`) checks WCAG 2.1 A and AA in
light and dark. These are the problems it found as serious or critical, and their fixes:

| Problem | Where | Fix |
| --- | --- | --- |
| `aria-valid-attr-value` (critical): `aria-controls` points at a list that isn't rendered | `ContributorSearch` (dashboard, Submissions) | `aria-controls` only while the list exists |
| `label-content-name-mismatch` (serious): the link shows initials, but its name is "Your profile" | header profile link | The initials are a decorative avatar (`aria-hidden`); the name is visually hidden text, "Your profile" |
| `label-content-name-mismatch`: the button shows "1×", but its name said "1x" | player speed button | Name "1× playback speed. Change speed" |
| Select with no accessible name (found reading the code; axe doesn't open edit mode) | AdminVideos "Quick move" | `htmlFor` and `id` (FU-63) |

The theme's colours passed. One contrast failure turned out to be measurement timing: a button
caught mid-fade as the session check finished. The spec now waits for the session check and for
finite animations before it scans.

## Tests

All new tests are named with their ID.

| Level | File | What | Rows |
| --- | --- | --- | --- |
| Backend unit | `requestId.test.js` | valid ids kept; too long, empty or other characters replaced; no header or an array header replaced | U-207–U-209 |
| Backend integration | `api-request-id.test.js` | a valid id is echoed; invalid ones come back as a fresh UUID, never the sent value; none gives a UUID | I-160–I-162 |
| Frontend unit | `securityHeaders.test.js` | see below | FU-43–FU-49 |
| Frontend unit | `cspSafeCode.test.js` | see below | FU-50–FU-59 |
| Frontend unit | `checkBundleSize.test.js` | the 300,000-byte limit; finds the entry chunk; passes at the limit and fails one byte over it | FU-60–FU-62 |
| Frontend unit | `AdminVideos.test.jsx` | the Quick move select has an accessible name | FU-63 |
| Frontend unit | `chunkReload.test.js` | first error reloads and prevents default; a second within 10 s of the reload doesn't; 10 s or more later it does; never twice from one page; blocked sessionStorage (throwing methods, or a throwing `window.sessionStorage`) still reloads once; the listener is on `window`; no reload while the page is being left, and back to normal after 3 s or on `pageshow` | FU-64–FU-71 |
| Frontend unit | `PageErrorBoundary.test.jsx` | the error and Reload button, with the header kept; another page clears it; the loading line while a reload is pending | FU-72–FU-74 |
| E2E fixture | `support/test.js` | see below | — |
| E2E | `csp.spec.js` | headers on every path (the page, a deep route, the theme script, the ffmpeg core); an injected inline script is blocked **and caught by the fixture**, in all three engines; the theme still applies; the sign-in photo comes from the site | E-13–E-16 |
| E2E | `admin-video-tool.spec.js` | see below | E-17 |
| E2E | `accessibility.spec.js` | the axe checks above: landing, home, a category, watch, the editor (Chromium), every admin tab, both themes | E-18–E-20 |
| E2E | `stale-chunks.spec.js` | from `/home`, My space's chunk answers 404 once: one reload, then the page opens. With the 404 kept: one reload, then the error and its Reload button, and still one reload 1.5 s later. Under the CSP fixture | E-21–E-22 |

**`securityHeaders.test.js`:**
- `vercel.json` equals the module for the production API.
- `vite preview` sends the same headers, and the dev server sends none.
- The exact directive set.
- No `'unsafe-inline'`, `'unsafe-eval'` or CDN for scripts.
- The other headers.
- A different API origin replaces the production one.
- `index.html` has no inline script.

**`cspSafeCode.test.js`:**
- `dataUrlToBlob`: base64 and percent-encoded URLs, with no `fetch`, and a non-data URL is
  refused.
- Cacheable origins; an external video is never fetched.
- `ffmpeg.load` gets `/ffmpeg/…` on the site's origin.
- Zod is jitless, and no module imports `zod` directly.
- `theme-init.js` applies the saved theme, or follows the system setting.

**`support/test.js`, the CSP fixture:** every test fails on a CSP violation.
- **How it records:** a `securitypolicyviolation` listener reports through `exposeBinding`, and
  console messages about the CSP are also caught.
- **Extra contexts:** a context a test opens itself gets the same set-up through
  `prepareContext(context)`.

**`admin-video-tool.spec.js`:** an admin processes a real clip with sound.
- ffmpeg loads from `/ffmpeg/` (checked on the network), and nothing comes from a CDN.
- "Ready to upload." appears, and the upload returns 201.
- **The stored file has its video track and no audio track.**

**Failing first:**
- **S10:** the unit file failed on the missing module. I-161 failed against `main`, because the
  invalid value was echoed.
- **Frontend:** the three new unit files failed on missing modules. FU-63 failed against the old
  `AdminVideos.jsx`.
- **E2E:** the first full run under the CSP failed. That run is the next section.
- **Stale chunks:** both new unit files failed on missing modules. With `installChunkReload()`
  commented out of `main.jsx`, both E2E tests failed in Chromium (no reload happened); with it
  back, they pass in all three engines. The two "leaving the page" unit tests were added with
  the fix for the Firefox failures above, which are what failed first.
- **axe on Admin → Activity (WebKit):** the same full run failed `color-contrast` on the pager's
  "Next" button (3.42:1). The scan had started while the page still said "Loading activity…";
  the button was disabled then and was measured while fading in from 50% opacity when the data
  arrived. `seriousProblems()` now also waits until no visible "Loading…" line is left, like it
  already waited for the session check. The colours are fine at rest. The spec then passed twice
  on every engine (`--repeat-each=2`), and in the full run.

### Existing tests I changed (no assertion weakened)

| Test | Change | Why |
| --- | --- | --- |
| `e2e/support/test.js` | `routeThirdParty` became `prepareContext` (third-party routes plus the CSP watcher); the Unsplash route is gone | The photo is self-hosted |
| `account-security`, `admin-activity`, `admin-deletion`, `admin-export` specs | call `prepareContext` on their second context | So those contexts are checked against the CSP too |
| `account-security.spec.js` `logIn()` | waits for the login heading before typing | A race the lazy pages exposed; see below |
| `cross-host-cookie.spec.js` | waits for the login heading in step 4, and step 5 runs in a separate context | Both explained below |
| `backend/tests/unit/traceability.test.js` | the allowed requirement IDs gain `QA-20`, and the no-requirement notes gain "browser hardening", "bundle size" and "deploy updates" (also added to the legend in `TEST-CASES.md`) | These tests have no FR or SE requirement. It still checks every row the same way. |

**The login race:** WebKit failed S6 in 1 of 3 runs.
- React Router 7 navigates inside `startTransition`. When the next page is lazy, React keeps
  showing the old page until it loads, while the URL already says `/login`.
- So the test typed into Forgot Password's "Email address" field, and Login then mounted empty.
- Users don't type within those milliseconds, so the app is fine. The test now waits for the page
  it means.
- It passed 3 of 3 runs on every engine afterwards.

**Cross-host step 5** is the "different site doesn't get the cookie" control.
- **What broke:** it used to `fetch` the API from the 127.0.0.1 build, whose CSP now blocks
  that request before any cookie question arises.
- **The fix:** it now runs in a context with Playwright's `bypassCSP`, holding a copy of the
  cookies with their `SameSite=Lax` attribute. The browser must still not send them cross-site,
  so it proves the same thing.
- **Why not a page Playwright serves itself:** Chromium treats such a page as public and blocks
  its requests to a loopback host (Private Network Access).

### Two engine limitations (annotated, not skipped quietly)
1. **Windows WebKit plays no video.** Playwright's Windows WebKit build gives
   `MEDIA_ERR_SRC_NOT_SUPPORTED` for both WebM and MP4, with or without the CSP (probed while
   writing E-17).
   - The tool needs a preview, so on that build E-17 checks the tool's fallback message instead
     and adds a `limitation` annotation.
   - The test first probes which fixture the engine can really decode. CI's Linux WebKit plays
     video through GStreamer.
2. **The editor's axe check runs in Chromium only.** Chromium is the only project with a fake
   camera to record with. It is a planned `test.skip` with that reason.

`TEST-CASES.md` now lists 106 files and 642 cases.

## Test gate results

| Gate | Result |
| --- | --- |
| Backend `test:unit` | 209 passed, 0 failed, 0 skipped |
| Backend `test:integration` | 162 passed, 0 failed, 0 skipped |
| Backend `test:security` | 81 passed, 0 failed, 0 skipped |
| Backend `test:coverage` | 452 passed; 94.67% lines, 90.34% branches (floors 85% / 75%); services 90.81% / 89.18%, middlewares 98.38% / 88.16%, utils 99.48% / 93.96% (floors 80% / 75%) |
| Frontend `lint` | clean |
| Frontend `test` | 124 passed (26 files) |
| Frontend `test:coverage` | 45.24% lines, 43.12% statements, 40.07% branches, 39.41% functions (all floors met; up from 40.5% lines) |
| Frontend `build` + `check:bundle` | main chunk 268.37 kB (limit 300 kB) |
| E2E | 64 passed, 2 skipped (the editor's axe check outside Chromium), 3 browsers, all under the CSP |
| `npm audit --omit=dev --audit-level=high` | backend 0, frontend 0, e2e 0 |
| Full frontend audit (dev included) | 3 moderate (eslint, @eslint/config-array, minimatch); before: 23 (14 high, 3 critical); no react-snap, `mkdirp` or `minimist` |

### CI

The CI runs for the last commit are given in the hand-off message and in a PR comment, since a
commit can't contain its own CI result.

## How to verify by hand

1. `cd frontend && npm run build && npm run preview`, then open `http://localhost:4173`.
   - The response headers include the CSP.
   - The browser console shows no CSP error on the landing page, login, a library page or the
     admin tabs.
2. Switch to dark, reload: there is no flash of the light theme. The sign-in page shows its photo.
3. **Admin → Videos:** pick a clip and "Apply changes". The network tab shows
   `/ffmpeg/ffmpeg-core.wasm` loaded from the site, and nothing from jsDelivr.
4. **Bundle:** `npm run check:bundle` prints 268.37 kB. Opening an admin page loads its own chunk.
5. **Request id:** `curl -H 'X-Request-Id: a b' …/api/v1/health -i` returns a UUID, not "a b".
6. **Stale chunks:** in the preview, sign in and stay on `/home`. In DevTools, block the request
   URL `*ProfileDashboard-*` (Network → Block request URL) and click My space. The page reloads
   once, then shows "This page could not be loaded." Unblock and press Reload: the page opens.

## Not done, and deviations from the plan

1. **Zod loads with its schemas** (decision 5). `api.admin.exportUrl` moved to
   `services/adminExport.js` as a result.
2. **`@ffmpeg/util` removed:** it was only used for `toBlobURL`, which is no longer needed.
3. **`style-src 'unsafe-inline'` stays,** as FIX-PLAN lists it. The production build injects no
   `<style>` tags, so it could probably be dropped later, after checking every page.
4. **Unit tests in `cspSafeCode.test.js`** cover the new helpers in one file rather than one file
   each.
5. **axe in E2E only** (`@axe-core/playwright`), not `@axe-core/react` in dev. FIX-PLAN allows
   either; this checks the built site under the CSP.

## Known risks

1. **The 32 MB `.wasm` on Vercel:** I believe a static file of that size is fine on Vercel, but
   couldn't confirm it here. After the next deployment, check that `/ffmpeg/ffmpeg-core.wasm`
   returns 200. Only admins download it.
2. **A new third-party host** (a font, an image, a video CDN) now needs a CSP change in
   `config/securityHeaders.js` and `vercel.json`. The unit test keeps the two equal.
3. **External videos are no longer cached in the browser** (decision 3). They stream from their
   host on each play.
4. **WebKit and the video tool on Windows** are covered only on CI's Linux WebKit. See the
   limitation above.
5. **Stale chunks with sessionStorage blocked:** the page can't remember that it just reloaded,
   so a chunk that stays missing reloads once per page load. That only happens with site data
   blocked and a chunk that is really gone; with sessionStorage available there is no loop
   (E-22).
5. **A page's first visit** downloads its chunk, which shows a short "Loading…" line on a slow
   connection.

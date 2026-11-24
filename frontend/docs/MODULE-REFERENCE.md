# Frontend module reference

For the complete runtime and data-flow explanation, see
[ARCHITECTURE.md](ARCHITECTURE.md). This page is a change-oriented map.

| Concern | Primary modules | Notes |
| --- | --- | --- |
| App entry, providers, and routes | `src/main.jsx`, `src/App.jsx`, `src/components/Layouts.jsx` | Provider nesting and route guards affect all pages. |
| Route paths and access | `src/routes/appRoutes.js`, `src/components/RouteGuards.jsx` | Use shared route builders for internal links. |
| Lazy pages, loading and page errors | `src/App.jsx` (`lazy()`), `src/components/PageLoading.jsx`, `src/components/PageErrorBoundary.jsx`, `src/utils/chunkReload.js` | Every page but the landing page is a lazy chunk. The layouts wrap the outlet in the error boundary and `<Suspense>`; `chunkReload` reloads once when a deploy removed an old chunk. |
| Security headers and bundle size | `config/securityHeaders.js`, `vercel.json`, `vite.config.js`, `scripts/checkBundleSize.js` | One CSP module for Vercel and `vite preview` (a unit test keeps `vercel.json` equal to it). A new third-party host needs a CSP change. CI fails when the main chunk passes 300 kB. |
| Admin submissions and the ML export (B5) | `src/pages/admin/AdminSubmissions.jsx`, `src/services/adminExport.js`, `src/utils/adminQueries.js` | The export link is built synchronously from the filters (`adminExportUrl`), so it lives outside `api.js`. |
| Authentication | `src/context/AuthProvider.jsx`, `src/pages/Signup.jsx`, `src/pages/Consent.jsx`, `src/pages/VerifyEmail.jsx` | Auth forms use React Hook Form and `src/utils/authSchemas.js`; consent is required before activating a new signup. |
| API transport and request validation | `src/services/api.js`, `src/services/apiRoutes.js`, `src/utils/validateApiInput.js` | Central place for credentials, response envelopes, normalization, endpoint paths, and auth request validation. Backend Zod remains authoritative. |
| Library and categories | `src/context/LibraryProvider.jsx`, `src/pages/Home.jsx`, `src/pages/CategoryBrowser.jsx` | Library context owns loaded categories/videos and admin mutations. |
| Admin messages and deletion requests (C3) | `src/pages/admin/AdminMessages.jsx`, `src/pages/admin/AdminUsers.jsx`, `api.admin.*` in `src/services/api.js` | Confirmations use `window.confirm` and always name the number of recordings. Lookups go by message id. |
| Admin video management | `src/pages/admin/AdminVideos.jsx`, `src/components/VideoPrep.jsx` | Supports uploaded media and direct HTTPS media URLs; URL sources require an uploaded poster. |
| Video playback and cache | `src/pages/Player.jsx`, `src/components/BasePlayer.jsx`, `src/components/ResponsiveVideo.jsx`, `src/hooks/useCachedVideo.js`, `src/utils/videoCache.js` | One native player; Blob cache has 5-minute TTL and size limits. |
| Camera and recording draft | `src/hooks/useRecorder.js`, `src/context/RecordingProvider.jsx`, `src/pages/RecordingEditor.jsx` | Unsubmitted recording blobs are memory-only. |
| Background submission uploads | `src/context/UploadQueueProvider.jsx`, `src/components/UploadToaster.jsx` | One upload at a time, one waiting slot; queue does not persist across tabs. |
| Theme and notifications | `src/context/ThemeProvider.jsx`, `src/context/NotificationProvider.jsx`, `public/theme-init.js` | Browser-local preferences and per-user notification state. Notifications are kept per browser (`localStorage`, `api.notifications`) and are not synced between devices: a decided limitation. `theme-init.js` sets the theme before first paint; keep it in step with `ThemeProvider`. |
| Styling | `src/styles/`, `src/index.css` | Global tokens and component styles are imported through `index.css`. |
| Tests | `test/unit/`, `test/integration/`, `test/support/` | Vitest and Testing Library; unit tests mock the API client, integration tests mock only HTTP with MSW. Use targeted files before the full suite. |

## API changes

When an API contract changes, update the API client, relevant provider or page,
tests, and both the backend OpenAPI/API references as appropriate. Backend
routes and server-side validation remain authoritative; do not duplicate
authorization rules in the browser as a security boundary.

## Media URL behavior

`video.videoUrl` may be a backend stream URL or a direct external HTTPS URL.
External sources use native `<video>` playback. The browser Blob cache needs
CORS permission from a cross-origin source; if a fetch fails, the player falls
back to the source URL. Poster images continue to use the backend poster
endpoint.

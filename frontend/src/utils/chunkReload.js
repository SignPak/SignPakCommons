/**
 * Stale chunks after a deploy. Every page but the landing page is a lazy chunk with a hashed
 * name (src/App.jsx). A tab opened before a Vercel deploy still asks for the old names, which
 * are gone, and the import fails ("Failed to fetch dynamically imported module"). Vite reports
 * that as a `vite:preloadError` event on window; this handler reloads the page once so the new
 * build is fetched.
 *
 * Loop guard: the time of the reload is kept in sessionStorage and in history.state (the current
 * history entry's state survives a reload and needs no storage, so it still works with site data
 * blocked). The newer of the two counts. If another preloadError comes within RELOAD_WINDOW_MS of
 * it, the chunk is really missing (or the network is down), so the error goes through to the
 * page's error boundary instead (components/PageErrorBoundary.jsx). If neither place can be
 * written, the handler does not reload at all: one Reload button beats a reload loop.
 *
 * A failure while the page is being left (after `beforeunload`) is ignored: Firefox aborts the
 * page's pending imports when a navigation starts, and reloading then would cancel it.
 */

export const RELOAD_KEY = 'signpak:chunk-reload-at'
export const RELOAD_WINDOW_MS = 10_000
// How long after `beforeunload` a failed import is put down to the page being left. Firefox
// aborts the old page's pending imports as soon as a navigation or reload starts; reloading then
// would cancel the visitor's own navigation. If the page stays (a download link also fires
// `beforeunload`), the handler is active again after this.
export const LEAVING_WINDOW_MS = 3_000

let reloading = false

/** True once the handler has asked for a reload, so the error boundary can keep showing "Loading…". */
export const isReloadingForNewBuild = () => reloading

function defaultStorage() {
  // Reading window.sessionStorage itself throws when site data is blocked.
  try { return window.sessionStorage } catch { return null }
}

function validStamp(raw) {
  if (raw === null || raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

function readStorageStamp(storage) {
  try { return validStamp(storage?.getItem(RELOAD_KEY)) } catch { return null }
}

function readHistoryStamp(history) {
  try { return validStamp(history?.state?.[RELOAD_KEY]) } catch { return null }
}

/** The newer valid stamp of the two places, or null. */
function readStamp(storage, history) {
  const stamps = [readStorageStamp(storage), readHistoryStamp(history)].filter((stamp) => stamp !== null)
  return stamps.length ? Math.max(...stamps) : null
}

/** True if the stamp was stored. */
function writeStorageStamp(storage, time) {
  if (!storage) return false
  try { storage.setItem(RELOAD_KEY, String(time)); return true } catch { return false }
}

/** True if the stamp was stored. Keeps the entry's other state (React Router's usr, key and idx). */
function writeHistoryStamp(history, time) {
  if (!history) return false
  try {
    const current = history.state && typeof history.state === 'object' ? history.state : {}
    history.replaceState({ ...current, [RELOAD_KEY]: time }, '')
    return true
  } catch {
    return false
  }
}

/** Calls `get`, or gives null if it throws (reading window.sessionStorage can). */
function orNull(get) {
  try { return get() ?? null } catch { return null }
}

function defaultHistory() {
  try { return window.history } catch { return null }
}

/**
 * Returns the `vite:preloadError` listener. `getStorage`, `getHistory`, `reload`, `now` and
 * `isLeaving` are injectable for the unit tests.
 */
export function createPreloadErrorHandler({
  getStorage = defaultStorage,
  getHistory = defaultHistory,
  reload = () => window.location.reload(),
  now = () => Date.now(),
  isLeaving = () => false,
} = {}) {
  let reloadedThisPage = false
  return function handlePreloadError(event) {
    // The page is on its way out: the import was aborted, not missing. Let the navigation happen.
    if (isLeaving()) return false
    const storage = orNull(getStorage)
    const history = orNull(getHistory)
    const time = now()
    const last = readStamp(storage, history)
    const recentReload = last !== null && time >= last && time - last < RELOAD_WINDOW_MS
    if (reloadedThisPage || recentReload) return false
    // Both writes always run. With neither stored, the reloaded page could not tell this reload
    // from a first failure, so don't reload: let the error through.
    const storedInStorage = writeStorageStamp(storage, time)
    const storedInHistory = writeHistoryStamp(history, time)
    if (!storedInStorage && !storedInHistory) return false
    reloadedThisPage = true
    reloading = true
    event.preventDefault()
    reload()
    return true
  }
}

/** Installs the handler once, from src/main.jsx. */
export function installChunkReload(target = window, options = {}) {
  let leavingUntil = 0
  const now = options.now ?? (() => Date.now())
  const onBeforeUnload = () => { leavingUntil = now() + LEAVING_WINDOW_MS }
  // Back from the back/forward cache: the page is in use again.
  const onPageShow = () => { leavingUntil = 0 }
  const handler = createPreloadErrorHandler({ isLeaving: () => now() < leavingUntil, ...options })
  target.addEventListener('beforeunload', onBeforeUnload)
  target.addEventListener('pageshow', onPageShow)
  target.addEventListener('vite:preloadError', handler)
  return () => {
    target.removeEventListener('beforeunload', onBeforeUnload)
    target.removeEventListener('pageshow', onPageShow)
    target.removeEventListener('vite:preloadError', handler)
  }
}

/** Test hook: forget a reload asked for by an earlier test. */
export function resetChunkReloadState() {
  reloading = false
}

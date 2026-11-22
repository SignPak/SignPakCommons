import { afterEach, describe, expect, it, vi } from 'vitest'
import { LEAVING_WINDOW_MS, RELOAD_KEY, RELOAD_WINDOW_MS, createPreloadErrorHandler, installChunkReload, isReloadingForNewBuild, resetChunkReloadState } from '../../src/utils/chunkReload'

/**
 * Stale chunks after a deploy: a tab opened before a Vercel deploy asks for page chunks that no
 * longer exist. Vite fires `vite:preloadError`; the handler reloads once, and lets the error
 * through if it happens again within 10 s of that reload.
 */

const preloadError = () => new Event('vite:preloadError', { cancelable: true })

function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) }
}

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  resetChunkReloadState()
})

describe('stale chunk reload', () => {
  it('Stale chunks: the first preloadError reloads the page once and stops the error', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    const handle = createPreloadErrorHandler({ getStorage: () => storage, reload, now: () => 50_000 })
    const event = preloadError()

    expect(handle(event)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    expect(storage.getItem(RELOAD_KEY)).toBe('50000')
    expect(isReloadingForNewBuild()).toBe(true)
  })

  it('Stale chunks: another preloadError within 10 s of that reload does not reload again', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    let time = 50_000
    createPreloadErrorHandler({ getStorage: () => storage, reload, now: () => time })(preloadError())
    resetChunkReloadState()

    // The reloaded page installs a fresh handler; the chunk is still missing.
    time += RELOAD_WINDOW_MS - 1
    const event = preloadError()
    expect(createPreloadErrorHandler({ getStorage: () => storage, reload, now: () => time })(event)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
    expect(isReloadingForNewBuild()).toBe(false)
  })

  it('Stale chunks: a failure 10 s or more after the last reload reloads again', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    let time = 50_000
    createPreloadErrorHandler({ getStorage: () => storage, reload, now: () => time })(preloadError())
    time += RELOAD_WINDOW_MS
    expect(createPreloadErrorHandler({ getStorage: () => storage, reload, now: () => time })(preloadError())).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('Stale chunks: a second preloadError on the same page never reloads twice', () => {
    const reload = vi.fn()
    let time = 50_000
    const handle = createPreloadErrorHandler({ getStorage: () => memoryStorage(), reload, now: () => time })
    handle(preloadError())
    time += RELOAD_WINDOW_MS * 2
    const event = preloadError()
    expect(handle(event)).toBe(false)
    expect(event.defaultPrevented).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('Stale chunks: blocked sessionStorage still reloads once', () => {
    const blocked = { getItem: () => { throw new DOMException('blocked', 'SecurityError') }, setItem: () => { throw new DOMException('blocked', 'SecurityError') } }
    const reload = vi.fn()
    const handle = createPreloadErrorHandler({ getStorage: () => blocked, reload })
    const event = preloadError()
    expect(handle(event)).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(handle(preloadError())).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)

    // Reading window.sessionStorage itself throws when site data is blocked.
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    const reloadToo = vi.fn()
    const noStorage = createPreloadErrorHandler({ reload: reloadToo })
    const second = preloadError()
    expect(noStorage(second)).toBe(true)
    expect(second.defaultPrevented).toBe(true)
    expect(reloadToo).toHaveBeenCalledTimes(1)
  })

  it('Stale chunks: installChunkReload listens for vite:preloadError on window and uses sessionStorage', () => {
    const reload = vi.fn()
    const remove = installChunkReload(window, { reload, now: () => 70_000 })
    const event = preloadError()
    window.dispatchEvent(event)
    remove()
    window.dispatchEvent(preloadError())

    expect(event.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe('70000')
  })

  it('Stale chunks: an import aborted because the visitor is leaving the page does not reload', () => {
    // Firefox aborts pending imports as soon as a navigation or reload starts.
    const reload = vi.fn()
    let time = 80_000
    const remove = installChunkReload(window, { reload, now: () => time })
    window.dispatchEvent(new Event('beforeunload'))
    const aborted = preloadError()
    window.dispatchEvent(aborted)
    expect(reload).not.toHaveBeenCalled()
    expect(aborted.defaultPrevented).toBe(false)
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull()

    // The page stayed (a download link also fires beforeunload): the handler is back after the window.
    time += LEAVING_WINDOW_MS
    const missing = preloadError()
    window.dispatchEvent(missing)
    remove()
    expect(missing.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('Stale chunks: a page restored from the back/forward cache handles a missing chunk again', () => {
    const reload = vi.fn()
    const remove = installChunkReload(window, { reload, now: () => 90_000 })
    window.dispatchEvent(new Event('beforeunload'))
    window.dispatchEvent(new Event('pageshow'))
    const missing = preloadError()
    window.dispatchEvent(missing)
    remove()
    expect(missing.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

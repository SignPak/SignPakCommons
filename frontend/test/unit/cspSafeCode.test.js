import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * S8: code that used to need a looser CSP. The poster is turned into a Blob without fetching a
 * data: URL (connect-src has no data:); external videos are never fetched for the cache
 * (connect-src is only the site and the API); ffmpeg's core comes from /ffmpeg on the site;
 * the theme script still sets the theme from public/theme-init.js.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('../../src/services/api')
  vi.doUnmock('@ffmpeg/ffmpeg')
})

describe('S8: dataUrlToBlob', () => {
  it('S8: a base64 data URL becomes a Blob of the same bytes and type, without fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dataUrlToBlob } = await import('../../src/utils/dataUrl')
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 250])
    const url = `data:image/jpeg;base64,${btoa(String.fromCharCode(...bytes))}`
    const blob = dataUrlToBlob(url)
    expect(blob.type).toBe('image/jpeg')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('S8: a percent-encoded (non-base64) data URL is decoded too', async () => {
    const { dataUrlToBlob } = await import('../../src/utils/dataUrl')
    const blob = dataUrlToBlob('data:text/plain,hello%20world')
    expect(blob.type).toBe('text/plain')
    expect(await blob.text()).toBe('hello world')
  })

  it('S8: anything that is not a data URL is refused', async () => {
    const { dataUrlToBlob } = await import('../../src/utils/dataUrl')
    expect(() => dataUrlToBlob('https://example.com/a.jpg')).toThrow()
  })
})

describe('S8: the video cache only fetches from the site and the API', () => {
  it('S8: isCacheableVideoUrl accepts the site and the API origin, and refuses any other host', async () => {
    const { isCacheableVideoUrl } = await import('../../src/utils/videoCache')
    const origins = { siteOrigin: 'https://commons.signpak.tech', apiOrigin: 'https://api.commons.signpak.tech' }
    expect(isCacheableVideoUrl('/api/v1/videos/1/file', origins)).toBe(true)
    expect(isCacheableVideoUrl('https://commons.signpak.tech/api/v1/videos/1/file', origins)).toBe(true)
    expect(isCacheableVideoUrl('https://api.commons.signpak.tech/api/v1/videos/1/file', origins)).toBe(true)
    expect(isCacheableVideoUrl('https://videos.example.com/hello.mp4', origins)).toBe(false)
    expect(isCacheableVideoUrl('https://api.commons.signpak.tech.evil.example/v.mp4', origins)).toBe(false)
    expect(isCacheableVideoUrl('not a url ::', { siteOrigin: 'https://commons.signpak.tech', apiOrigin: '' })).toBe(true)
  })

  it('S8: an external video is never fetched: loadVideo rejects at once, so the player streams it', async () => {
    const fetchVideo = vi.fn(async () => new Blob(['x'], { type: 'video/mp4' }))
    vi.doMock('../../src/services/api', () => ({ api: { media: { fetchVideo } } }))
    const { loadVideo, prefetchVideo } = await import('../../src/utils/videoCache')
    await expect(loadVideo({ videoUrl: 'https://videos.example.com/hello.mp4' })).rejects.toMatchObject({ code: 'EXTERNAL' })
    prefetchVideo({ videoUrl: 'https://videos.example.com/next.mp4' })
    expect(fetchVideo).not.toHaveBeenCalled()

    const entry = await loadVideo({ videoUrl: '/api/v1/videos/1/file' })
    expect(fetchVideo).toHaveBeenCalledTimes(1)
    expect(fetchVideo.mock.calls[0][0]).toBe('/api/v1/videos/1/file')
    expect(entry.blob.size).toBe(1)
  })
})

describe('S8: ffmpeg is loaded from /ffmpeg on the site', () => {
  it('S8: ffmpeg.load gets the core and wasm from /ffmpeg/ on this origin, never a CDN', async () => {
    const loads = []
    vi.doMock('@ffmpeg/ffmpeg', () => ({
      FFmpeg: class {
        on() {}
        off() {}
        async load(options) { loads.push(options) }
        async writeFile() {}
        async exec() { return 0 }
        async readFile() { return new Uint8Array([1, 2, 3]) }
        async deleteFile() {}
      },
    }))
    const { processVideo } = await import('../../src/utils/processVideo')
    const out = await processVideo(new File([new Uint8Array([9])], 'clip.webm', { type: 'video/webm' }), { removeAudio: true, trim: null })
    expect(out.name).toBe('clip.webm')
    expect(loads).toEqual([{
      coreURL: `${window.location.origin}/ffmpeg/ffmpeg-core.js`,
      wasmURL: `${window.location.origin}/ffmpeg/ffmpeg-core.wasm`,
    }])
  })
})

describe('S8: Zod never probes eval', () => {
  it('S8: loading a schema module switches Zod to jitless (no new Function under the CSP)', async () => {
    const { z } = await import('zod')
    await import('../../src/utils/authSchemas')
    expect(z.config().jitless).toBe(true)
  })

  it('S8: every schema module gets Zod through src/utils/zod.js, so the setting always applies first', () => {
    const dir = path.join(root, 'src')
    const offenders = []
    const walk = (folder) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(js|jsx|mjs)$/.test(entry.name) && full !== path.join(dir, 'utils', 'zod.js') && /from ['"]zod['"]/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full))
      }
    }
    walk(dir)
    expect(offenders).toEqual([])
  })
})

describe('S8: public/theme-init.js', () => {
  const run = () => new Function(fs.readFileSync(path.join(root, 'public/theme-init.js'), 'utf8'))()
  let meta

  beforeEach(() => {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#f3faf6'
    document.head.append(meta)
  })
  afterEach(() => {
    meta.remove()
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('S8: the saved theme is applied before the app loads, with the matching theme colour', () => {
    localStorage.setItem('signpak:theme', 'dark')
    run()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(meta.getAttribute('content')).toBe('#00401a')
    localStorage.setItem('signpak:theme', 'light')
    run()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(meta.getAttribute('content')).toBe('#f3faf6')
  })

  it('S8: without a saved theme it follows the system setting', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    run()
    expect(document.documentElement.dataset.theme).toBe('dark')
    vi.unstubAllGlobals()
  })
})

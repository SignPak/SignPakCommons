import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Phase 10: the small helpers in src/utils that had no direct test (media, validators, format)
 * and the video cache's own behaviour (sharing a download, keeping and releasing videos).
 */

describe('media helpers', () => {
  it('Utils: aspectOf gives width / height, or null when a side is unknown', async () => {
    const { aspectOf } = await import('../../src/utils/media')
    expect(aspectOf({ width: 1920, height: 1080 })).toBeCloseTo(16 / 9)
    expect(aspectOf({ width: '720', height: '1280' })).toBeCloseTo(0.5625)
    expect(aspectOf({ width: 0, height: 1080 })).toBeNull()
    expect(aspectOf(null)).toBeNull()
  })

  it('Utils: orientationOf calls near-square videos square', async () => {
    const { orientationOf } = await import('../../src/utils/media')
    expect(orientationOf(0.5625)).toBe('portrait')
    expect(orientationOf(1)).toBe('square')
    expect(orientationOf(1.04)).toBe('square')
    expect(orientationOf(16 / 9)).toBe('landscape')
  })

  describe('inspectVideoFile', () => {
    let video
    let canvas
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:local/1')
      URL.revokeObjectURL = vi.fn()
      video = { videoWidth: 1280, videoHeight: 720, duration: 4.6 }
      canvas = { getContext: () => ({ drawImage: vi.fn() }), toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAA') }
      const create = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag) => tag === 'video' ? video : tag === 'canvas' ? canvas : create(tag))
    })
    afterEach(() => vi.restoreAllMocks())

    it('Utils: inspectVideoFile reads the duration and size and grabs a poster frame at most 640 px wide', async () => {
      const { inspectVideoFile } = await import('../../src/utils/media')
      const pending = inspectVideoFile(new Blob(['v']))
      expect(video).toMatchObject({ src: 'blob:local/1', preload: 'metadata', muted: true })
      video.onloadedmetadata()
      expect(video.currentTime).toBe(1)
      video.onseeked()
      await expect(pending).resolves.toEqual({ durationSec: 5, width: 1280, height: 720, poster: 'data:image/jpeg;base64,AAA' })
      expect(canvas).toMatchObject({ width: 640, height: 360 })
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local/1')
    })

    it('Utils: inspectVideoFile keeps the size when the poster cannot be drawn, and gives zeros for an unreadable file', async () => {
      const { inspectVideoFile } = await import('../../src/utils/media')
      canvas.getContext = () => { throw new Error('tainted') }
      const drawn = inspectVideoFile(new Blob(['v']))
      video.onseeked()
      await expect(drawn).resolves.toEqual({ durationSec: 5, width: 1280, height: 720, poster: '' })

      const broken = inspectVideoFile(new Blob(['x']))
      video.onerror()
      await expect(broken).resolves.toEqual({ durationSec: 0, width: 0, height: 0, poster: '' })
    })
  })
})

describe('profile link validators', () => {
  it('Utils: GitHub accepts a username or a profile link, and refuses anything else', async () => {
    const { normalizeGithub } = await import('../../src/utils/validators')
    expect(normalizeGithub('  ')).toEqual({ value: null })
    expect(normalizeGithub('sara-ahmed')).toEqual({ value: 'sara-ahmed' })
    expect(normalizeGithub('@sara')).toEqual({ value: 'sara' })
    expect(normalizeGithub('https://www.github.com/sara/')).toEqual({ value: 'sara' })
    expect(normalizeGithub('sara--ahmed').error).toMatch(/GitHub username/)
    expect(normalizeGithub('https://evil.example/sara').error).toMatch(/GitHub username/)
  })

  it('Utils: LinkedIn accepts a profile slug or link, and always stores the full https link', async () => {
    const { normalizeLinkedin } = await import('../../src/utils/validators')
    expect(normalizeLinkedin('')).toEqual({ value: null })
    expect(normalizeLinkedin('sara-ahmed')).toEqual({ value: 'https://www.linkedin.com/in/sara-ahmed' })
    expect(normalizeLinkedin('linkedin.com/in/sara-ahmed/')).toEqual({ value: 'https://www.linkedin.com/in/sara-ahmed' })
    expect(normalizeLinkedin('https://pk.linkedin.com/in/sara_a')).toEqual({ value: 'https://www.linkedin.com/in/sara_a' })
    expect(normalizeLinkedin('ab').error).toMatch(/LinkedIn profile link/)
    expect(normalizeLinkedin('https://linkedin.com/company/x y').error).toMatch(/LinkedIn profile link/)
  })

  it('Utils: safeRouteId keeps plain ids and drops anything that could change a URL', async () => {
    const { safeRouteId } = await import('../../src/utils/validators')
    expect(safeRouteId('0123456789abcdef01234567')).toBe('0123456789abcdef01234567')
    expect(safeRouteId('a_b-C')).toBe('a_b-C')
    expect(safeRouteId('../admin')).toBeNull()
    expect(safeRouteId('')).toBeNull()
    expect(safeRouteId(42)).toBeNull()
  })
})

describe('format helpers', () => {
  it('Utils: formatTime shows mm:ss and treats bad input as zero', async () => {
    const { formatTime } = await import('../../src/utils/format')
    expect(formatTime(75.9)).toBe('01:15')
    expect(formatTime()).toBe('00:00')
    expect(formatTime(-3)).toBe('00:00')
    expect(formatTime(Number.NaN)).toBe('00:00')
  })

  it('Utils: formatBytes picks B, KB or MB', async () => {
    const { formatBytes } = await import('../../src/utils/format')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(90 * 1024 * 1024)).toBe('90.0 MB')
    expect(formatBytes()).toBe('0 B')
  })

  it('Utils: initialsOf and greeting', async () => {
    const { greeting, initialsOf } = await import('../../src/utils/format')
    expect(initialsOf({ firstName: 'sara', surname: 'ahmed' })).toBe('SA')
    expect(initialsOf({ firstName: 'Nida' })).toBe('N')
    expect(initialsOf(null)).toBe('')
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Good morning')
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon')
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening')
  })
})

describe('video cache', () => {
  let fetchVideo
  let cache
  beforeEach(async () => {
    vi.resetModules()
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => `blob:cache/${Math.random()}`)
    URL.revokeObjectURL = vi.fn()
    fetchVideo = vi.fn()
    vi.doMock('../../src/services/api', () => ({ api: { media: { fetchVideo } } }))
    cache = await import('../../src/utils/videoCache')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock('../../src/services/api')
    vi.restoreAllMocks()
  })

  const video = { videoUrl: '/api/v1/videos/v1/file' }

  it('Utils: two players asking for one video share one download and both hear the progress', async () => {
    let finish
    fetchVideo.mockImplementation((_url, { onProgress }) => new Promise((resolve) => { finish = () => { onProgress(0.5); resolve(new Blob(['abc'])) } }))
    const first = vi.fn()
    const second = vi.fn()
    const one = cache.loadVideo(video, first)
    const two = cache.loadVideo(video, second)
    finish()
    const [entryOne, entryTwo] = await Promise.all([one, two])
    expect(entryOne).toBe(entryTwo)
    expect(fetchVideo).toHaveBeenCalledTimes(1)
    expect(first.mock.calls.map(([value]) => value)).toEqual([0.5, 1])
    expect(second.mock.calls.map(([value]) => value)).toEqual([0.5, 1])

    // Already cached: progress is complete at once, with no new download.
    const third = vi.fn()
    await cache.loadVideo(video, third)
    expect(third).toHaveBeenCalledWith(1)
    expect(fetchVideo).toHaveBeenCalledTimes(1)
  })

  it('Utils: a removed progress listener hears nothing more', async () => {
    let finish
    fetchVideo.mockImplementation((_url, { onProgress }) => new Promise((resolve) => { finish = () => { onProgress(0.3); resolve(new Blob(['abc'])) } }))
    const listener = vi.fn()
    const pending = cache.loadVideo(video, listener)
    cache.removeVideoProgressListener(video.videoUrl, listener)
    finish()
    await pending
    expect(listener).not.toHaveBeenCalled()
  })

  it('Utils: a failed download is forgotten, so the next attempt downloads again', async () => {
    fetchVideo.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Blob(['abc']))
    await expect(cache.loadVideo(video)).rejects.toThrow('offline')
    await expect(cache.loadVideo(video)).resolves.toMatchObject({ blob: expect.any(Blob) })
    expect(fetchVideo).toHaveBeenCalledTimes(2)
  })

  it('Utils: an expired video is kept for a player still using it, then released', async () => {
    fetchVideo.mockResolvedValue(new Blob(['abc']))
    const entry = await cache.loadVideo(video)
    const url = entry.url
    cache.holdVideo(entry)
    vi.advanceTimersByTime(cache.VIDEO_TTL_MS)
    expect(entry.expired).toBe(true)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    cache.releaseVideo(entry)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    expect(entry.url).toBe('')

    // After expiry the next request downloads it again.
    await cache.loadVideo(video)
    expect(fetchVideo).toHaveBeenCalledTimes(2)
  })

  it('Utils: past the 250 MB budget the oldest videos are dropped first', async () => {
    const big = (name) => Object.assign(new Blob([name]), {})
    const sizes = new Map()
    fetchVideo.mockImplementation(async (url) => {
      const blob = big(url)
      Object.defineProperty(blob, 'size', { value: sizes.get(url) })
      return blob
    })
    const mb = 1024 * 1024
    sizes.set('/a', 100 * mb).set('/b', 100 * mb).set('/c', 100 * mb)
    const a = await cache.loadVideo({ videoUrl: '/a' })
    vi.advanceTimersByTime(10)
    await cache.loadVideo({ videoUrl: '/b' })
    vi.advanceTimersByTime(10)
    await cache.loadVideo({ videoUrl: '/c' })
    expect(a.expired).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('Utils: prefetchVideo downloads in the background and ignores failures', async () => {
    fetchVideo.mockRejectedValue(new Error('offline'))
    expect(() => cache.prefetchVideo(video)).not.toThrow()
    cache.prefetchVideo(null)
    cache.prefetchVideo({})
    await Promise.resolve()
    expect(fetchVideo).toHaveBeenCalledTimes(1)
  })
})

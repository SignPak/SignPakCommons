import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../src/services/api'
import { apiRoutes } from '../../src/services/apiRoutes'
import { server, setupMockApi } from '../support/mswServer'

/**
 * Phase 10: the API client (src/services/api.js and apiRoutes.js) against a mocked network.
 * Every call goes to the right method and path, sends the right body, validates its input
 * before sending, and turns the API's { data } / { error } envelopes into values and errors.
 */

setupMockApi()

/** Records every request to the API and answers each with `reply(request)`, or { data: [] }. */
function recordApi(reply = () => HttpResponse.json({ data: [] })) {
  const calls = []
  server.use(http.all('*/api/v1/*', async ({ request }) => {
    const url = new URL(request.url)
    const type = request.headers.get('content-type') || ''
    const body = type.includes('application/json') ? await request.clone().json() : null
    calls.push({ method: request.method, path: `${url.pathname}${url.search}`, body, deviceId: request.headers.get('x-device-id') })
    return reply(request)
  }))
  return calls
}

/** A FormData's fields; files are shown as `file:<name>`. */
const formFields = (form) => Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : `file:${value.name}`]))

/**
 * Form uploads: the network mock can't read jsdom's FormData back, so these tests look at the
 * FormData the client hands to fetch instead.
 */
function captureFetch(data = {}, status = 201) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }))
}
function sentForm(fetchSpy) {
  const [path, options] = fetchSpy.mock.calls[0]
  return { path, method: options.method, body: formFields(options.body), headers: options.headers, credentials: options.credentials }
}

/** A stand-in XMLHttpRequest for the background upload, which uses XHR to report upload progress. */
class FakeXhr {
  static last = null
  constructor() {
    this.headers = {}
    this.upload = {}
    FakeXhr.last = this
  }
  open(method, url) { Object.assign(this, { method, url }) }
  setRequestHeader(name, value) { this.headers[name] = value }
  send(body) { this.body = body }
  abort() { this.onabort?.() }
  respond(status, payload) {
    this.status = status
    this.responseText = typeof payload === 'string' ? payload : JSON.stringify(payload)
    this.onload?.()
    this.onloadend?.()
  }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

const PASSWORD = 'password1'
const ID = '0123456789abcdef01234567'

describe('API client: routes and request bodies', () => {
  const cases = [
    ['auth.session', () => api.auth.session(), 'GET', '/api/v1/auth/session'],
    ['auth.register', () => api.auth.register({ firstName: ' Sara ', surname: 'Ahmed', email: 'SARA@Example.com', password: PASSWORD, confirmPassword: PASSWORD }), 'POST', '/api/v1/auth/signup', { firstName: 'Sara', surname: 'Ahmed', email: 'sara@example.com', password: PASSWORD, confirmPassword: PASSWORD }],
    ['auth.login', () => api.auth.login('sara@example.com', PASSWORD), 'POST', '/api/v1/auth/login', { email: 'sara@example.com', password: PASSWORD }],
    ['auth.verifyEmail', () => api.auth.verifyEmail('sara@example.com', '123456', PASSWORD), 'POST', '/api/v1/auth/verify-email', { email: 'sara@example.com', code: '123456', password: PASSWORD }],
    ['auth.completeSignup', () => api.auth.completeSignup('consent-token-123', 'v1'), 'POST', '/api/v1/auth/consent', { consentToken: 'consent-token-123', accepted: true, version: 'v1' }],
    ['auth.declineSignup', () => api.auth.declineSignup('consent-token-123'), 'POST', '/api/v1/auth/decline-consent', { consentToken: 'consent-token-123' }],
    ['auth.resendVerification', () => api.auth.resendVerification('sara@example.com'), 'POST', '/api/v1/auth/resend-verification', { email: 'sara@example.com' }],
    ['auth.forgotPassword', () => api.auth.forgotPassword('sara@example.com'), 'POST', '/api/v1/auth/forgot-password', { email: 'sara@example.com' }],
    ['auth.resetPassword', () => api.auth.resetPassword({ email: 'sara@example.com', code: '123456', password: PASSWORD, confirmPassword: PASSWORD }), 'POST', '/api/v1/auth/reset-password', { email: 'sara@example.com', code: '123456', password: PASSWORD, confirmPassword: PASSWORD }],
    ['auth.logout', () => api.auth.logout(), 'POST', '/api/v1/auth/logout'],
    ['auth.acceptConsent', () => api.auth.acceptConsent('v1'), 'POST', '/api/v1/users/me/consent', { accepted: true, version: 'v1' }],
    ['auth.saveConnections', () => api.auth.saveConnections('user-1', { github: 'sara' }), 'PATCH', '/api/v1/users/me', { connections: { github: 'sara' } }],
    ['users.removeMe', () => api.users.removeMe(PASSWORD), 'DELETE', '/api/v1/users/me', { password: PASSWORD }],
    ['users.changePassword', () => api.users.changePassword({ currentPassword: 'old-pass', password: PASSWORD, confirmPassword: PASSWORD }), 'POST', '/api/v1/users/me/password', { currentPassword: 'old-pass', password: PASSWORD, confirmPassword: PASSWORD }],
    ['users.list', () => api.users.list(), 'GET', '/api/v1/admin/users'],
    ['users.page', () => api.users.page({ role: 'admin', q: 'sara' }), 'GET', '/api/v1/admin/users?limit=50&role=admin&q=sara'],
    ['users.setStatus', () => api.users.setStatus(ID, { status: 'suspended' }), 'PATCH', `/api/v1/admin/users/${ID}`, { status: 'suspended' }],
    ['users.remove', () => api.users.remove(ID), 'DELETE', `/api/v1/admin/users/${ID}`],
    ['users.remove with recordings', () => api.users.remove(ID, { withRecordings: true }), 'DELETE', `/api/v1/admin/users/${ID}?withRecordings=true`],
    ['admin.restrictions', () => api.admin.restrictions(), 'GET', '/api/v1/admin/restrictions'],
    ['admin.createRestriction', () => api.admin.createRestriction({ type: 'device', value: 'abc', reason: '' }), 'POST', '/api/v1/admin/restrictions', { type: 'device', value: 'abc', reason: '' }],
    ['admin.removeRestriction', () => api.admin.removeRestriction(ID), 'DELETE', `/api/v1/admin/restrictions/${ID}`],
    ['admin.messages', () => api.admin.messages({ topic: 'deletion', verified: true }), 'GET', '/api/v1/admin/messages?topic=deletion&verified=true'],
    ['admin.setMessageStatus', () => api.admin.setMessageStatus('m 1', 'resolved'), 'PATCH', '/api/v1/admin/messages/m%201', { status: 'resolved' }],
    ['admin.userSubmissions', () => api.admin.userSubmissions(ID, { limit: 1 }), 'GET', `/api/v1/admin/users/${ID}/submissions?limit=1`],
    ['admin.removeUserSubmissions', () => api.admin.removeUserSubmissions(ID, { requestMessageId: 'm1' }), 'DELETE', `/api/v1/admin/users/${ID}/submissions?requestMessageId=m1`],
    ['admin.deletionLookup', () => api.admin.deletionLookup({ email: 'sara@example.com' }), 'GET', '/api/v1/admin/deletion-lookup?email=sara%40example.com'],
    ['admin.stats', () => api.admin.stats({ days: 30, categoryId: ID }), 'GET', `/api/v1/admin/stats?days=30&categoryId=${ID}`],
    ['admin.submissions', () => api.admin.submissions({ videoId: ID }), 'GET', `/api/v1/admin/submissions?videoId=${ID}&limit=25`],
    ['admin.audit', () => api.admin.audit({ actor: 'system' }), 'GET', '/api/v1/admin/audit?page=1&limit=25&actor=system'],
    ['categories.list', () => api.categories.list(), 'GET', '/api/v1/categories'],
    ['categories.create', () => api.categories.create({ label: 'Greetings', tone: 'green' }), 'POST', '/api/v1/categories', { label: 'Greetings', tone: 'green' }],
    ['categories.update', () => api.categories.update(ID, { label: 'Hello' }), 'PATCH', `/api/v1/categories/${ID}`, { label: 'Hello' }],
    ['categories.remove', () => api.categories.remove(ID), 'DELETE', `/api/v1/categories/${ID}`],
    ['videos.list', () => api.videos.list(), 'GET', '/api/v1/videos'],
    ['videos.update', () => api.videos.update(ID, { status: 'published' }), 'PATCH', `/api/v1/videos/${ID}`, { status: 'published' }],
    ['videos.remove', () => api.videos.remove(ID), 'DELETE', `/api/v1/videos/${ID}`],
    ['demoVideo.get', () => api.demoVideo.get(), 'GET', '/api/v1/demo-video'],
    ['demoVideo.remove', () => api.demoVideo.remove(), 'DELETE', '/api/v1/demo-video'],
    ['submissions.list', () => api.submissions.list({ mine: true, limit: 10 }), 'GET', '/api/v1/submissions?mine=true&limit=10'],
    ['contact.send', () => api.contact.send({ topic: 'general', message: 'Hello' }), 'POST', '/api/v1/contact', { topic: 'general', message: 'Hello' }],
    ['contact.verify', () => api.contact.verify('req/1', '123456'), 'POST', '/api/v1/contact/req%2F1/verify', { code: '123456' }],
    ['contact.resend', () => api.contact.resend('req/1'), 'POST', '/api/v1/contact/req%2F1/resend'],
  ]

  it.each(cases)('API client: %s sends the right request', async (_name, call, method, path, body = null) => {
    const calls = recordApi()
    await call()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method, path, body })
  })

  it('API client: every request carries the browser\'s device ID, the same one each time', async () => {
    const calls = recordApi()
    await api.categories.list()
    await api.videos.list()
    const deviceId = localStorage.getItem('signpak:v1:device-id')
    expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(calls.map((call) => call.deviceId)).toEqual([deviceId, deviceId])
  })

  it('API client: no device ID is sent when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    const calls = recordApi()
    await api.categories.list()
    expect(calls[0].deviceId).toBeNull()
  })

  it('API client: the less common route builders give the API paths', () => {
    expect(apiRoutes.health()).toBe('/api/v1/health')
    expect(apiRoutes.videos.get('v1')).toBe('/api/v1/videos/v1')
    expect(apiRoutes.videos.poster('v1')).toBe('/api/v1/videos/v1/poster')
    expect(apiRoutes.videos.file('v1')).toBe('/api/v1/videos/v1/file')
    expect(apiRoutes.demoVideo.file()).toBe('/api/v1/demo-video/file')
    expect(apiRoutes.submissions.recording('s1')).toBe('/api/v1/submissions/s1/recording')
    expect(apiRoutes.admin.users()).toBe('/api/v1/admin/users')
    expect(apiRoutes.admin.exportSubmissions({ format: 'csv', videoId: 'v1', from: '' })).toBe('/api/v1/admin/submissions/export?format=csv&videoId=v1')
  })
})

describe('API client: inputs are validated before anything is sent', () => {
  it('API client: an invalid sign-up never reaches the network and names the fields', async () => {
    const calls = recordApi()
    const error = await api.auth.register({ firstName: '', surname: 'Ahmed', email: 'not-an-email', password: 'short' }).catch((caught) => caught)
    expect(calls).toHaveLength(0)
    expect(error.fields).toMatchObject({ firstName: expect.any(String), email: expect.any(String), password: expect.any(String) })
  })

  it('API client: an invalid admin query never reaches the network', async () => {
    const calls = recordApi()
    await expect(api.admin.submissions({ from: '2026-02-01', to: '2026-01-01' })).rejects.toThrow()
    await expect(api.admin.stats({ days: 3 })).rejects.toThrow()
    await expect(api.users.page({ role: 'owner' })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})

describe('API client: responses', () => {
  it('API client: dates become timestamps and the API\'s file paths stay on the site', async () => {
    recordApi(() => HttpResponse.json({ data: [{ id: 'v1', createdAt: '2026-01-02T03:04:05.000Z', videoUrl: '/api/v1/videos/v1/file', poster: 'https://cdn.example/p.jpg', readAt: null }] }))
    const [video] = await api.videos.list()
    expect(video.createdAt).toBe(Date.parse('2026-01-02T03:04:05.000Z'))
    expect(video.videoUrl).toBe('/api/v1/videos/v1/file')
    expect(video.poster).toBe('https://cdn.example/p.jpg')
    expect(video.readAt).toBeNull()
  })

  it('API client: an error envelope becomes an Error with the message, the fields and the status', async () => {
    recordApi(() => HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Check the form.', fields: { label: 'Too long.' } } }, { status: 422 }))
    const error = await api.categories.create({ label: 'x'.repeat(200) }).catch((caught) => caught)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Check the form.')
    expect(error.fields).toEqual({ label: 'Too long.' })
    expect(error.status).toBe(422)
  })

  it('API client: a failure with no JSON body still gives the status', async () => {
    recordApi(() => new HttpResponse('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
    const error = await api.videos.list().catch((caught) => caught)
    expect(error.message).toBe('Request failed (502)')
    expect(error.fields).toEqual({})
    expect(error.status).toBe(502)
  })

  it('API client: 204 No Content resolves to undefined', async () => {
    recordApi(() => new HttpResponse(null, { status: 204 }))
    await expect(api.categories.remove(ID)).resolves.toBeUndefined()
  })

  it('API client: a list endpoint with no data gives an empty list', async () => {
    recordApi(() => HttpResponse.json({}))
    await expect(api.categories.list()).resolves.toEqual([])
  })

  it('API client: a users page normalises its items and keeps the paging fields', async () => {
    recordApi(() => HttpResponse.json({ data: { items: [{ id: 'u1', createdAt: '2026-01-01T00:00:00.000Z' }], nextCursor: 'c1', total: 3 } }))
    const page = await api.users.page()
    expect(page).toEqual({ items: [{ id: 'u1', createdAt: Date.parse('2026-01-01T00:00:00.000Z') }], nextCursor: 'c1', total: 3 })
  })
})

describe('API client: public statistics', () => {
  const STATS = { contributors: 4, publishedVideos: 12, categories: 3 }

  it('API client: statistics are fetched once, then served from the 30-minute browser cache', async () => {
    const calls = recordApi(() => HttpResponse.json({ data: STATS }))
    await expect(api.public.stats()).resolves.toEqual(STATS)
    await expect(api.public.stats()).resolves.toEqual(STATS)
    expect(calls).toHaveLength(1)
  })

  it('API client: two statistics requests at once share one network call', async () => {
    const calls = recordApi(() => HttpResponse.json({ data: STATS }))
    const [first, second] = await Promise.all([api.public.stats(), api.public.stats()])
    expect(first).toEqual(STATS)
    expect(second).toEqual(STATS)
    expect(calls).toHaveLength(1)
  })

  it('API client: an expired or malformed cache entry is dropped and fetched again', async () => {
    const calls = recordApi(() => HttpResponse.json({ data: STATS }))
    localStorage.setItem('signpak:v1:public-stats', JSON.stringify({ value: STATS, savedAt: Date.now() - 31 * 60 * 1000 }))
    await api.public.stats()
    localStorage.setItem('signpak:v1:public-stats', JSON.stringify({ value: { contributors: -1 }, savedAt: Date.now() }))
    await api.public.stats()
    localStorage.setItem('signpak:v1:public-stats', '{not json')
    await api.public.stats()
    expect(calls).toHaveLength(3)
  })

  it('API client: statistics in the wrong shape are refused and not cached', async () => {
    recordApi(() => HttpResponse.json({ data: { contributors: 'many' } }))
    await expect(api.public.stats()).rejects.toThrow('The server returned invalid community statistics.')
    expect(localStorage.getItem('signpak:v1:public-stats')).toBeNull()
  })

  it('API client: statistics still arrive when browser storage is full', async () => {
    recordApi(() => HttpResponse.json({ data: STATS }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    await expect(api.public.stats()).resolves.toEqual(STATS)
  })
})

describe('API client: uploads', () => {
  it('API client: a reference video is sent as a form, with the poster image decoded in memory', async () => {
    const fetchSpy = captureFetch({ id: 'v1' })
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' })
    await api.videos.create({ file, poster: 'data:image/jpeg;base64,/9j/', title: 'Hello', categoryId: 'c1', status: 'draft', durationSec: 3, width: 640, height: 360 })
    const sent = sentForm(fetchSpy)
    expect(sent).toMatchObject({ method: 'POST', path: '/api/v1/videos', credentials: 'include' })
    expect(sent.body).toEqual({ video: 'file:clip.webm', poster: 'file:poster.jpg', title: 'Hello', categoryId: 'c1', status: 'draft', durationSec: '3', width: '640', height: '360' })
    // A form keeps the browser's own multipart Content-Type; only JSON bodies get one set.
    expect(sent.headers.get('Content-Type')).toBeNull()
  })

  it('API client: an external video is sent by URL, with no file and defaults for the size', async () => {
    const fetchSpy = captureFetch({ id: 'v2' })
    await api.videos.create({ videoUrl: 'https://cdn.example/v.mp4', poster: new Blob(['p'], { type: 'image/jpeg' }), title: 'Remote', status: 'published' })
    expect(sentForm(fetchSpy).body).toEqual({ videoUrl: 'https://cdn.example/v.mp4', poster: 'file:poster.jpg', title: 'Remote', categoryId: '', status: 'published', durationSec: '0', width: '0', height: '0' })
  })

  it('API client: a poster that is neither a Blob nor a data URL is left out', async () => {
    const fetchSpy = captureFetch({ id: 'v3' })
    await api.videos.create({ file: new File(['v'], 'v.webm'), poster: 'https://cdn.example/p.jpg', title: 'T', categoryId: 'c1', status: 'draft' })
    expect(sentForm(fetchSpy).body).not.toHaveProperty('poster')
  })

  it('API client: the demo video is sent as a form', async () => {
    const fetchSpy = captureFetch({ id: 'd1' })
    await api.demoVideo.upload({ file: new File(['v'], 'demo.mp4'), title: 'How it works', durationSec: 20 })
    expect(sentForm(fetchSpy)).toMatchObject({ method: 'POST', path: '/api/v1/demo-video', body: { video: 'file:demo.mp4', title: 'How it works', durationSec: '20', width: '0', height: '0' } })
  })

  it('API client: a recording is submitted with its trim and mirror values', async () => {
    const fetchSpy = captureFetch({ id: 's1', submittedAt: '2026-01-01T00:00:00.000Z' })
    const created = await api.submissions.create({ recording: new Blob(['r'], { type: 'video/webm' }), videoId: 'v1', trimStart: 0.5, trimEnd: 2.25, mirrored: 1, duration: 3 })
    expect(sentForm(fetchSpy)).toMatchObject({ method: 'POST', path: '/api/v1/submissions' })
    expect(sentForm(fetchSpy).body).toEqual({ recording: 'file:recording.webm', videoId: 'v1', trimStart: '0.5', trimEnd: '2.25', mirrored: 'true', duration: '3' })
    expect(created.submittedAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'))
  })

  describe('the background upload (XMLHttpRequest, for progress)', () => {
    beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr))
    afterEach(() => vi.unstubAllGlobals())
    const upload = (extra = {}) => api.submissions.upload({ recording: new Blob(['r'], { type: 'video/webm' }), videoId: 'v1', trimStart: 0, trimEnd: 2, mirrored: false, duration: 2, ...extra })

    it('API client: the background upload sends the form with credentials and the device ID, reports progress and returns the submission', async () => {
      const onProgress = vi.fn()
      const pending = upload({ onProgress })
      const xhr = FakeXhr.last
      expect(xhr).toMatchObject({ method: 'POST', url: '/api/v1/submissions', withCredentials: true })
      expect(xhr.headers['X-Device-ID']).toBe(localStorage.getItem('signpak:v1:device-id'))
      expect(formFields(xhr.body)).toEqual({ recording: 'file:recording.webm', videoId: 'v1', trimStart: '0', trimEnd: '2', mirrored: 'false', duration: '2' })
      xhr.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 })
      xhr.upload.onprogress({ lengthComputable: false, loaded: 7, total: 0 })
      xhr.respond(201, { data: { id: 's2', submittedAt: '2026-01-01T00:00:00.000Z' } })
      await expect(pending).resolves.toEqual({ id: 's2', submittedAt: Date.parse('2026-01-01T00:00:00.000Z') })
      expect(onProgress).toHaveBeenCalledTimes(1)
      expect(onProgress).toHaveBeenCalledWith(0.5)
    })

    it("API client: a refused background upload rejects with the API's message, fields and status", async () => {
      const pending = upload()
      FakeXhr.last.respond(413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'That file is too large.' } })
      await expect(pending).rejects.toMatchObject({ message: 'That file is too large.', status: 413, fields: {} })
    })

    it('API client: a background upload that fails without JSON still gives the status', async () => {
      const pending = upload()
      FakeXhr.last.respond(502, '<html>Bad gateway</html>')
      await expect(pending).rejects.toMatchObject({ message: 'Request failed (502)', status: 502 })
    })

    it('API client: a lost connection during a background upload gives a clear message', async () => {
      const pending = upload()
      FakeXhr.last.onerror()
      await expect(pending).rejects.toThrow('The connection was lost while uploading. Check your internet and try again.')
    })

    it('API client: a background upload can be cancelled before or during the upload', async () => {
      const before = new AbortController()
      before.abort()
      await expect(upload({ signal: before.signal })).rejects.toMatchObject({ name: 'AbortError' })

      const during = new AbortController()
      const pending = upload({ signal: during.signal })
      during.abort()
      await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: 'Upload cancelled.' })
    })
  })
})

describe('API client: downloading a video into the browser', () => {
  it('API client: a video from the API is downloaded with progress, credentials and the device ID', async () => {
    const calls = recordApi(() => new HttpResponse(new Uint8Array(10), { headers: { 'Content-Type': 'video/webm', 'Content-Length': '10' } }))
    const onProgress = vi.fn()
    const blob = await api.media.fetchVideo('/api/v1/videos/v1/file', { onProgress })
    expect(blob.size).toBe(10)
    expect(blob.type).toBe('video/webm')
    expect(onProgress).toHaveBeenLastCalledWith(1)
    expect(calls[0].deviceId).toBe(localStorage.getItem('signpak:v1:device-id'))
  })

  it('API client: a video larger than the limit is refused before or while it downloads', async () => {
    recordApi(() => new HttpResponse(new Uint8Array(10), { headers: { 'Content-Length': '10' } }))
    await expect(api.media.fetchVideo('/api/v1/videos/v1/file', { maxBytes: 5 })).rejects.toMatchObject({ code: 'TOO_LARGE' })
    recordApi(() => new HttpResponse(new Uint8Array(10)))
    await expect(api.media.fetchVideo('/api/v1/videos/v1/file', { maxBytes: 5 })).rejects.toMatchObject({ code: 'TOO_LARGE' })
  })

  it('API client: a failed download names the status', async () => {
    recordApi(() => new HttpResponse(null, { status: 404 }))
    await expect(api.media.fetchVideo('/api/v1/videos/v1/file')).rejects.toThrow('The video could not be loaded (404).')
  })
})

describe('API client: notifications stay in this browser', () => {
  it('API client: notifications are per user, newest first, and can be marked read one by one or all at once', async () => {
    const first = await api.notifications.create('u1', { title: 'One' })
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = await api.notifications.create('u1', { title: 'Two' })
    await api.notifications.create('u2', { title: 'Other user' })

    expect((await api.notifications.list('u1')).map((item) => item.id)).toEqual([second.id, first.id])
    await api.notifications.markRead('u1', first.id)
    expect((await api.notifications.list('u1')).find((item) => item.id === first.id).readAt).toEqual(expect.any(Number))
    expect((await api.notifications.list('u1')).find((item) => item.id === second.id).readAt).toBeNull()

    await api.notifications.markAllRead('u1')
    expect((await api.notifications.list('u1')).every((item) => item.readAt)).toBe(true)
    expect((await api.notifications.list('u2'))[0].readAt).toBeNull()
  })

  it('API client: unreadable stored notifications read as none', async () => {
    localStorage.setItem('signpak:v1:notifications', '{broken')
    await expect(api.notifications.list('u1')).resolves.toEqual([])
  })
})

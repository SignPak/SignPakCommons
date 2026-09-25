import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { Client, filesIn, jpeg, mp4, recordingForm, videoForm, webm } from './helpers.js'

const { default: app } = await import('../src/app.js')
const { connectDb, disconnectDb } = await import('../src/config/db.js')
const { authService } = await import('../src/services/authService.js')
const { storageService } = await import('../src/services/storage/index.js')
const { default: mongoose } = await import('mongoose')

let server, memory, base, admin, contributor, other
const asJson = (res) => res.body
const contributorData = { firstName: 'Sara', surname: 'Ahmed', email: 'Sara@Example.com', password: 'password1', confirmPassword: 'password1' }

before(async () => {
  let uri = process.env.MONGODB_URI_TEST
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    memory = await MongoMemoryServer.create()
    uri = memory.getUri('signpak_test')
  }
  await connectDb(uri)
  await mongoose.connection.dropDatabase()
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()))
  await storageService.init()
  await authService.ensureAdminFromEnv()
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}/api/v1`

  admin = new Client(base)
  assert.equal((await admin.post('/auth/login', { email: 'admin@signpak.test', password: 'Admin@12345' })).status, 200)
  contributor = new Client(base)
  assert.equal((await contributor.post('/auth/signup', contributorData)).status, 201)
  other = new Client(base)
  await other.post('/auth/signup', { firstName: 'Omar', surname: 'Khan', email: 'omar@example.com', password: 'password1' })
})

after(async () => {
  server?.close()
  await mongoose.connection.dropDatabase().catch(() => {})
  await disconnectDb()
  await memory?.stop()
})

describe('basics', () => {
  test('root advertises the API and favicon is ignored', async () => {
    const origin = new URL(base).origin
    const root = await new Client(origin).get('/')
    assert.equal(root.status, 200)
    assert.equal(root.body.data.api, '/api/v1')
    assert.equal(root.body.data.docs, '/api/v1/docs')
    assert.equal((await new Client(origin).get('/favicon.ico')).status, 204)
  })

  test('health check reports the database', async () => {
    const res = await new Client(base).get('/health')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.database, 'connected')
  })

  test('unknown routes and bad JSON use the error shape', async () => {
    const c = new Client(base)
    const missing = await c.get('/nope')
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error.code, 'NOT_FOUND')
    const bad = await c.request('POST', '/auth/login', { headers: { 'content-type': 'application/json' }, form: '{oops' })
    assert.equal(bad.status, 400)
    assert.equal(bad.body.error.code, 'BAD_REQUEST')
  })

  test('cross-origin writes are refused, allowed origin passes', async () => {
    const c = new Client(base)
    const evil = await c.post('/contact', { name: 'a', email: 'a@b.co', message: 'hi' }, { headers: { origin: 'https://evil.example' } })
    assert.equal(evil.status, 403)
    const fine = await c.post('/contact', { name: 'a', email: 'a@b.co', message: 'hi' }, { headers: { origin: 'http://localhost:5173' } })
    assert.equal(fine.status, 201)
  })
})

describe('auth', () => {
  test('signup validates every field', async () => {
    const res = await new Client(base).post('/auth/signup', {})
    assert.equal(res.status, 422)
    assert.equal(res.body.error.code, 'VALIDATION_ERROR')
    for (const field of ['firstName', 'surname', 'email', 'password']) assert.ok(res.body.error.fields[field], `missing error for ${field}`)
    const mismatch = await new Client(base).post('/auth/signup', { ...contributorData, email: 'x@example.com', confirmPassword: 'different' })
    assert.equal(mismatch.body.error.fields.confirmPassword, 'Passwords do not match.')
    const short = await new Client(base).post('/auth/signup', { ...contributorData, email: 'x@example.com', password: 'short', confirmPassword: undefined })
    assert.equal(short.body.error.fields.password, 'Use at least 8 characters.')
  })

  test('signup sets an httpOnly cookie and never leaks the hash or accepts a role', async () => {
    const c = new Client(base)
    const res = await c.post('/auth/signup', { firstName: 'Eve', surname: 'Hacker', email: 'eve@example.com', password: 'password1', role: 'admin' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.role, 'user')
    assert.equal(res.body.data.email, 'eve@example.com')
    assert.equal(res.body.data.passwordHash, undefined)
    assert.match(res.setCookie[0], /HttpOnly/i)
    assert.match(res.setCookie[0], /SameSite=Lax/i)
    assert.equal((await c.get('/admin/stats')).status, 403)
  })

  test('duplicate emails conflict, case-insensitively', async () => {
    const res = await new Client(base).post('/auth/signup', { ...contributorData, email: 'SARA@example.com' })
    assert.equal(res.status, 409)
    assert.ok(res.body.error.fields.email)
  })

  test('login: wrong password and unknown email give the same answer', async () => {
    const wrong = await new Client(base).post('/auth/login', { email: 'sara@example.com', password: 'nope-nope' })
    const unknown = await new Client(base).post('/auth/login', { email: 'ghost@example.com', password: 'nope-nope' })
    assert.equal(wrong.status, 401)
    assert.equal(unknown.status, 401)
    assert.equal(wrong.body.error.message, unknown.body.error.message)
  })

  test('session, logout and tampered cookies', async () => {
    const c = new Client(base)
    assert.equal((await c.get('/auth/session')).body.data, null)
    assert.equal((await c.post('/auth/login', { email: 'SARA@example.com', password: 'password1' })).status, 200)
    assert.equal((await c.get('/auth/session')).body.data.firstName, 'Sara')
    assert.equal((await c.post('/auth/logout')).status, 204)
    assert.equal((await c.get('/auth/session')).body.data, null)
    c.cookies.set('signpak_token', 'not.a.jwt')
    assert.equal((await c.get('/users/me')).status, 401)
  })

  test('the env admin exists once, has the admin role, and re-running is harmless', async () => {
    await authService.ensureAdminFromEnv()
    const users = (await admin.get('/admin/users')).body.data
    assert.equal(users.filter((u) => u.email === 'admin@signpak.test').length, 1)
    assert.equal(users.find((u) => u.email === 'admin@signpak.test').role, 'admin')
  })

  test('admin-only routes reject contributors and visitors', async () => {
    assert.equal((await contributor.get('/admin/users')).status, 403)
    assert.equal((await new Client(base).get('/admin/users')).status, 401)
  })
})

describe('profile connections', () => {
  test('normalises, validates, and disconnects', async () => {
    const ok = await contributor.patch('/users/me', { connections: { github: 'https://github.com/octocat', linkedin: 'linkedin.com/in/sara-ahmed' } })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.data.connections.github, 'octocat')
    assert.equal(ok.body.data.connections.linkedin, 'https://www.linkedin.com/in/sara-ahmed')
    const bad = await contributor.patch('/users/me', { connections: { github: 'not a user!!' } })
    assert.equal(bad.status, 422)
    assert.ok(bad.body.error.fields['connections.github'])
    const off = await contributor.patch('/users/me', { connections: { github: null } })
    assert.equal(off.body.data.connections.github, null)
    assert.equal(off.body.data.connections.linkedin, 'https://www.linkedin.com/in/sara-ahmed') // untouched
    assert.equal((await new Client(base).patch('/users/me', { connections: {} })).status, 401)
  })
})

let daily, work, video1, video2, draft

describe('categories', () => {
  test('only admins write; names are unique regardless of case', async () => {
    assert.equal((await contributor.post('/categories', { label: 'Nope' })).status, 403)
    const made = await admin.post('/categories', { label: 'Daily phrases', copy: 'Everyday.', tone: 'yellow' })
    assert.equal(made.status, 201)
    daily = made.body.data
    assert.equal(daily.labelKey, undefined)
    work = (await admin.post('/categories', { label: 'Work', tone: 'blue' })).body.data
    const dup = await admin.post('/categories', { label: 'daily PHRASES' })
    assert.equal(dup.status, 409)
    assert.ok(dup.body.error.fields.label)
    assert.equal((await admin.post('/categories', { label: 'X', tone: 'purple' })).status, 422)
  })

  test('update and public listing', async () => {
    const res = await admin.patch(`/categories/${work.id}`, { copy: 'Meetings.' })
    assert.equal(res.body.data.copy, 'Meetings.')
    assert.equal((await admin.patch(`/categories/${work.id}`, { label: 'Daily Phrases' })).status, 409)
    assert.equal((await admin.patch(`/categories/${work.id}`, {})).status, 422)
    const list = await new Client(base).get('/categories')
    assert.equal(list.body.data.length, 2)
    assert.equal((await admin.patch('/categories/not-an-id', { copy: 'x' })).status, 422)
  })
})

describe('videos', () => {
  test('upload needs a real video file', async () => {
    const none = await admin.upload('/videos', videoForm({ title: 'No file' }, { video: null }))
    assert.equal(none.status, 422)
    assert.ok(none.body.error.fields.video)
    const fake = await admin.upload('/videos', videoForm({ title: 'Fake' }, { video: Buffer.from('this is just text, not a video at all') }))
    assert.equal(fake.status, 422)
    assert.match(fake.body.error.fields.video, /MP4, WebM or MOV/)
    const noTitle = await admin.upload('/videos', videoForm({ level: 'Beginner' }))
    assert.equal(noTitle.status, 422)
    assert.ok(noTitle.body.error.fields.title)
    const missingCategory = await admin.upload('/videos', videoForm({ title: 'Ghost cat', categoryId: '64b7f0f0f0f0f0f0f0f0f0f0' }))
    assert.equal(missingCategory.status, 422)
    assert.equal((await contributor.upload('/videos', videoForm({ title: 'Nope' }))).status, 403)
    assert.equal((await new Client(base).upload('/videos', videoForm({ title: 'Nope' }))).status, 401)
    assert.deepEqual(filesIn('videos'), [], 'rejected uploads must not leave files behind')
    assert.deepEqual(filesIn('tmp'), [], 'rejected uploads must not leave temp files behind')
  })

  test('admin uploads with and without a poster; the API hides storage internals', async () => {
    const a = await admin.upload('/videos', videoForm({ title: 'Nice to meet you', categoryId: daily.id, level: 'Beginner', durationSec: '134' }, { poster: jpeg() }))
    assert.equal(a.status, 201, JSON.stringify(a.body))
    video1 = a.body.data
    assert.equal(video1.categoryId, daily.id)
    assert.equal(video1.order, 1)
    assert.equal(video1.durationSec, 134)
    assert.equal(video1.videoUrl, `/api/v1/videos/${video1.id}/file`)
    assert.equal(video1.poster, `/api/v1/videos/${video1.id}/poster`)
    assert.equal(video1.videoFile, undefined)
    assert.equal(video1.size, webm().length)
    const b = await admin.upload('/videos', videoForm({ title: 'A warm introduction', categoryId: daily.id }, { video: mp4() }))
    video2 = b.body.data
    assert.equal(video2.order, 2)
    assert.equal(video2.poster, null)
    assert.equal(video2.status, 'published')
    draft = (await admin.upload('/videos', videoForm({ title: 'Secret draft', categoryId: daily.id, status: 'draft' }))).body.data
    const loose = (await admin.upload('/videos', videoForm({ title: 'Unassigned', categoryId: '' }))).body.data
    assert.equal(loose.categoryId, null)
    assert.equal(filesIn('videos').length, 4)
    assert.equal(filesIn('posters').length, 1)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('visibility: contributors and visitors only see published, categorised videos', async () => {
    const titles = (res) => res.body.data.map((v) => v.title).sort()
    assert.deepEqual(titles(await admin.get('/videos')), ['A warm introduction', 'Nice to meet you', 'Secret draft', 'Unassigned'])
    assert.deepEqual(titles(await contributor.get('/videos')), ['A warm introduction', 'Nice to meet you'])
    assert.deepEqual(titles(await new Client(base).get('/videos')), ['A warm introduction', 'Nice to meet you'])
    assert.equal((await contributor.get(`/videos/${draft.id}`)).status, 404)
    assert.equal((await admin.get(`/videos/${draft.id}`)).status, 200)
  })

  test('published files stream publicly with Range support', async () => {
    const full = await new Client(base).get(`/videos/${video1.id}/file`, { raw: true })
    assert.equal(full.status, 200)
    assert.equal(full.headers.get('accept-ranges'), 'bytes')
    assert.equal(full.headers.get('content-type'), 'video/webm')
    assert.deepEqual(full.body, webm())
    const part = await contributor.get(`/videos/${video1.id}/file`, { raw: true, headers: { range: 'bytes=10-19' } })
    assert.equal(part.status, 206)
    assert.equal(part.headers.get('content-range'), `bytes 10-19/${webm().length}`)
    assert.deepEqual(part.body, webm().subarray(10, 20))
    const tail = await contributor.get(`/videos/${video1.id}/file`, { raw: true, headers: { range: 'bytes=-5' } })
    assert.deepEqual(tail.body, webm().subarray(-5))
    assert.equal((await contributor.get(`/videos/${video1.id}/file`, { raw: true, headers: { range: 'bytes=99999-' } })).status, 416)
    assert.equal((await contributor.get(`/videos/${draft.id}/file`)).status, 404)
    const mp4res = await contributor.get(`/videos/${video2.id}/file`, { raw: true })
    assert.equal(mp4res.headers.get('content-type'), 'video/mp4')
  })

  test('posters are served as images', async () => {
    const res = await new Client(base).get(`/videos/${video1.id}/poster`, { raw: true })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/jpeg')
    assert.equal((await new Client(base).get(`/videos/${video2.id}/poster`)).status, 404)
  })

  test('editing: moving categories appends to the end of that path', async () => {
    const moved = await admin.patch(`/videos/${video2.id}`, { categoryId: work.id })
    assert.equal(moved.body.data.categoryId, work.id)
    assert.equal(moved.body.data.order, 1)
    const back = await admin.patch(`/videos/${video2.id}`, { categoryId: daily.id })
    assert.ok(back.body.data.order > draft.order, 'moved video goes after everything already in the path')
    assert.equal((await admin.patch(`/videos/${video2.id}`, { status: 'archived' })).status, 422)
    assert.equal((await admin.patch(`/videos/${video2.id}`, { categoryId: '64b7f0f0f0f0f0f0f0f0f0f0' })).status, 422)
    const unpublished = await admin.patch(`/videos/${draft.id}`, { title: 'Still a draft' })
    assert.equal(unpublished.body.data.title, 'Still a draft')
    assert.equal((await contributor.patch(`/videos/${video2.id}`, { title: 'hax' })).status, 403)
  })
})

let submission

describe('submissions and the cooldown rule', () => {
  const good = () => ({ videoId: video1.id, trimStart: '0', trimEnd: '2.5', duration: '3', mirrored: 'true' })

  test('input is checked before anything is stored', async () => {
    const before = filesIn('recordings').length
    assert.equal((await new Client(base).upload('/submissions', recordingForm(good()))).status, 401)
    assert.equal((await contributor.upload('/submissions', recordingForm(good(), { file: null }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm(good(), { file: Buffer.from('plain text pretending to be video') }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), trimStart: '2', trimEnd: '1' }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), trimEnd: '30' }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), videoId: 'nope' }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), videoId: draft.id }))).status, 404)
    assert.equal(filesIn('recordings').length, before)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('a valid submission is stored and listed', async () => {
    const res = await contributor.upload('/submissions', recordingForm(good()))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    submission = res.body.data
    assert.equal(submission.videoId, video1.id)
    assert.equal(submission.mirrored, true)
    assert.equal(submission.trimEnd, 2.5)
    assert.equal(submission.recording, undefined)
    assert.equal(filesIn('recordings').length, 1)
    const mine = await contributor.get('/submissions')
    assert.equal(mine.body.data.length, 1)
    assert.equal((await other.get('/submissions')).body.data.length, 0)
    assert.equal((await admin.get('/submissions')).body.data.length, 1)
  })

  test('COOLDOWN: a second submission for the same video, too soon, is refused and stores nothing', async () => {
    const again = await contributor.upload('/submissions', recordingForm(good(), { file: mp4() }))
    assert.equal(again.status, 409)
    assert.match(again.body.error.message, /wait \d+s/i)
    assert.equal(filesIn('recordings').length, 1)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('COOLDOWN: concurrent double-submits for the same video produce exactly one submission', async () => {
    const results = await Promise.all([1, 2, 3].map(() => other.upload('/submissions', recordingForm({ ...good(), videoId: video2.id }))))
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409])
    assert.equal(filesIn('recordings').length, 2, 'losing uploads must not leave orphaned files')
    assert.equal((await other.get('/submissions')).body.data.length, 1)
  })

  test('COOLDOWN: once it elapses, the same video can be submitted again, as a new, separate recording', async () => {
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.SUBMISSION_COOLDOWN_MS) + 20))
    const res = await contributor.upload('/submissions', recordingForm(good(), { file: mp4() }))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.notEqual(res.body.data.id, submission.id)
    const mine = await contributor.get('/submissions')
    assert.equal(mine.body.data.length, 2, 'both recordings for this video are kept, not merged or replaced')
  })

  test('a submission can never be edited or deleted once made, and contributors cannot watch their own back', async () => {
    assert.equal((await contributor.patch(`/submissions/${submission.id}`, { trimEnd: 1 })).status, 404)
    assert.equal((await contributor.delete(`/submissions/${submission.id}`)).status, 404)
    assert.equal((await contributor.get(`/submissions/${submission.id}/recording`)).status, 403)
    assert.equal((await other.get(`/submissions/${submission.id}/recording`)).status, 403)
  })

  test('admins can watch a submission (with Range), and it is not cacheable', async () => {
    const res = await admin.get(`/submissions/${submission.id}/recording`, { raw: true })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, webm(3000))
    assert.match(res.headers.get('cache-control'), /no-store/)
    const part = await admin.get(`/submissions/${submission.id}/recording`, { raw: true, headers: { range: 'bytes=0-3' } })
    assert.equal(part.status, 206)
  })

  test('deleting a base video keeps contributors\' submissions on record', async () => {
    const before = filesIn('videos').length
    assert.equal((await admin.delete(`/videos/${video2.id}`)).status, 204)
    assert.equal(filesIn('videos').length, before - 1, 'the base video file is removed from storage')
    assert.equal((await admin.get(`/videos/${video2.id}`)).status, 404)
    assert.equal((await other.get('/submissions')).body.data.length, 1)
  })
})

describe('admin stats and contact', () => {
  test('stats add up', async () => {
    assert.equal((await contributor.get('/admin/stats')).status, 403)
    const res = await admin.get('/admin/stats?days=7')
    assert.equal(res.status, 200)
    const { totals, activity, byCategory, recent } = res.body.data
    assert.equal(totals.contributors, 3) // sara, omar, eve
    assert.equal(totals.submissions, 3) // sara's two takes on video1 (cooldown test), plus omar's one on video2
    assert.equal(totals.categories, 2)
    assert.equal(totals.videos, 3)
    assert.equal(totals.publishedVideos, 2) // video 1 and the unassigned one; the draft is not counted
    assert.equal(activity.length, 7)
    assert.equal(activity.reduce((sum, d) => sum + d.count, 0), 3)
    assert.equal(activity.at(-1).date, new Date().toISOString().slice(0, 10))
    // Omar's video was deleted earlier, so it counts towards totals and activity but no longer belongs to a category.
    assert.equal(byCategory.find((c) => c.categoryId === daily.id).count, 2) // both of sara's video1 submissions
    assert.equal(byCategory.find((c) => c.categoryId === work.id).count, 0)
    assert.equal(recent.length, 3)
    assert.ok(['Sara Ahmed', 'Omar Khan'].includes(recent[0].contributor.name))
    assert.equal(recent.find((r) => r.video === null)?.category, null) // the deleted video
    assert.equal((await admin.get('/admin/stats?days=1000')).status, 422)
  })

  test('deleting a category unassigns its videos instead of deleting them', async () => {
    assert.equal((await admin.delete(`/categories/${daily.id}`)).status, 204)
    const kept = await admin.get(`/videos/${video1.id}`)
    assert.equal(kept.status, 200)
    assert.equal(kept.body.data.categoryId, null)
    assert.equal((await contributor.get(`/videos/${video1.id}`)).status, 404) // hidden from contributors now
  })

  test('contact messages: public to send, admin to read', async () => {
    const c = new Client(base)
    const bad = await c.post('/contact', { name: '', email: 'nope', message: '' })
    assert.equal(bad.status, 422)
    assert.ok(bad.body.error.fields.email)
    assert.equal((await c.post('/contact', { name: 'Maya', email: 'maya@example.com', message: 'Hello!' })).status, 201)
    const list = await admin.get('/admin/messages')
    assert.equal(list.status, 200)
    assert.ok(list.body.data.some((m) => m.name === 'Maya' && m.message === 'Hello!'))
    assert.equal((await contributor.get('/admin/messages')).status, 403)
  })

  test('oversized uploads are rejected with 413', async () => {
    const res = await admin.upload('/videos', videoForm({ title: 'Huge' }, { video: webm(6 * 1024 * 1024) }))
    assert.equal(res.status, 413)
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE')
    assert.deepEqual(filesIn('tmp'), [])
  })
})

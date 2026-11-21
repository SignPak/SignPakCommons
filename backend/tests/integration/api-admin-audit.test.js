import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { Client, recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * S7 / D5: every admin action writes exactly one activity-log entry naming the admin who did
 * it; the startup sync promotes and demotes admins from ADMIN_EMAILS; GET /admin/audit lists
 * the log a page at a time and filters it. Through the real HTTP stack.
 */

const getContext = useApiContext({ after })
let base, admin, adminId, createVerifiedUser, mongoose, authService

before(async () => {
  ;({ base, admin, createVerifiedUser, mongoose, authService } = await getContext())
  adminId = (await admin.get('/auth/session')).body.data.id
})

// Each test looks at the entries its own actions wrote.
beforeEach(async () => {
  await mongoose.models.AuditLog?.deleteMany({})
  await mongoose.models.ContactSenderQuota.deleteMany({})
})

const AuditLog = () => mongoose.models.AuditLog
const entries = async () => {
  assert.ok(AuditLog(), 'the AuditLog model exists')
  return (await AuditLog().find().sort({ at: 1, _id: 1 }).lean()).map((entry) => ({
    actorId: entry.actorId ? String(entry.actorId) : null, action: entry.action, targetType: entry.targetType, targetId: entry.targetId, meta: entry.meta,
  }))
}
const shape = (list) => list.map(({ actorId, action, targetType, targetId }) => ({ actorId, action, targetType, targetId }))
const idOf = async (client) => (await client.get('/auth/session')).body.data.id

async function publishedVideo(label) {
  const category = (await admin.post('/categories', { label, tone: 'blue' })).body.data
  const video = (await admin.upload('/videos', videoForm({ title: `${label} video`, categoryId: category.id, durationSec: '3' }))).body.data
  await AuditLog()?.deleteMany({})
  return video
}

describe('S7: each admin action writes one activity entry with the acting admin', () => {
  test('S7: category create, update and delete', async () => {
    const made = await admin.post('/categories', { label: 'Audit Food', tone: 'yellow' })
    assert.equal(made.status, 201)
    const id = made.body.data.id
    assert.equal((await admin.patch(`/categories/${id}`, { label: 'Audit Meals' })).status, 200)
    assert.equal((await admin.delete(`/categories/${id}`)).status, 204)

    const log = await entries()
    assert.deepEqual(shape(log), [
      { actorId: adminId, action: 'category.create', targetType: 'category', targetId: id },
      { actorId: adminId, action: 'category.update', targetType: 'category', targetId: id },
      { actorId: adminId, action: 'category.delete', targetType: 'category', targetId: id },
    ])
    assert.equal(log[0].meta.label, 'Audit Food')
    assert.equal(log[1].meta.label, 'Audit Meals')
  })

  test('S7: video create, update and delete', async () => {
    const category = (await admin.post('/categories', { label: 'Audit Video Path', tone: 'red' })).body.data
    await AuditLog()?.deleteMany({})
    const made = await admin.upload('/videos', videoForm({ title: 'Audit Hello', categoryId: category.id, durationSec: '3' }))
    assert.equal(made.status, 201, JSON.stringify(made.body))
    const id = made.body.data.id
    assert.equal((await admin.patch(`/videos/${id}`, { title: 'Audit Goodbye' })).status, 200)
    assert.equal((await admin.delete(`/videos/${id}`)).status, 204)

    const log = await entries()
    assert.deepEqual(shape(log), [
      { actorId: adminId, action: 'video.create', targetType: 'video', targetId: id },
      { actorId: adminId, action: 'video.update', targetType: 'video', targetId: id },
      { actorId: adminId, action: 'video.delete', targetType: 'video', targetId: id },
    ])
    assert.equal(log[0].meta.title, 'Audit Hello')
    assert.equal(log[1].meta.title, 'Audit Goodbye')
    assert.equal(log[1].meta.changed, 'title')
  })

  test('S7: demo video upload and delete', async () => {
    const made = await admin.upload('/demo-video', videoForm({ title: 'Audit demo', durationSec: '4' }))
    assert.equal(made.status, 201, JSON.stringify(made.body))
    assert.equal((await admin.delete('/demo-video')).status, 204)
    const log = await entries()
    assert.deepEqual(shape(log).map(({ actorId, action, targetType }) => ({ actorId, action, targetType })), [
      { actorId: adminId, action: 'demo.upload', targetType: 'demo' },
      { actorId: adminId, action: 'demo.delete', targetType: 'demo' },
    ])
    assert.equal(log[0].meta.title, 'Audit demo')
  })

  test('S7: user suspend, reactivate and delete', async () => {
    const user = await createVerifiedUser({ firstName: 'Audit', surname: 'Target', email: 'audit.target@example.com' })
    const id = await idOf(user)
    await AuditLog().deleteMany({})
    assert.equal((await admin.patch(`/admin/users/${id}`, { status: 'suspended', reason: 'Spam uploads' })).status, 200)
    assert.equal((await admin.patch(`/admin/users/${id}`, { status: 'active' })).status, 200)
    assert.equal((await admin.delete(`/admin/users/${id}`)).status, 204)

    const log = await entries()
    assert.deepEqual(shape(log), [
      { actorId: adminId, action: 'user.suspend', targetType: 'user', targetId: id },
      { actorId: adminId, action: 'user.reactivate', targetType: 'user', targetId: id },
      { actorId: adminId, action: 'user.delete', targetType: 'user', targetId: id },
    ])
    assert.equal(log[0].meta.reason, 'Spam uploads')
    assert.equal(log[2].meta.withRecordings, false)
  })

  test('S7: deleting recordings writes one entry; deleting an account with its recordings writes two', async () => {
    const video = await publishedVideo('Audit Recordings')
    const first = await createVerifiedUser({ firstName: 'Rec', surname: 'One', email: 'audit.rec1@example.com' })
    const second = await createVerifiedUser({ firstName: 'Rec', surname: 'Two', email: 'audit.rec2@example.com' })
    for (const client of [first, second]) {
      const res = await client.upload('/submissions', recordingForm({ videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' }))
      assert.equal(res.status, 201, JSON.stringify(res.body))
    }
    const [firstId, secondId] = [await idOf(first), await idOf(second)]
    await AuditLog().deleteMany({})

    assert.equal((await admin.delete(`/admin/users/${firstId}/submissions`)).status, 200)
    let log = await entries()
    assert.deepEqual(shape(log), [{ actorId: adminId, action: 'recordings.delete', targetType: 'user', targetId: firstId }])
    assert.equal(log[0].meta.deleted, 1)
    assert.equal(log[0].meta.failed, 0)

    await AuditLog().deleteMany({})
    assert.equal((await admin.delete(`/admin/users/${secondId}?withRecordings=true`)).status, 204)
    log = await entries()
    assert.deepEqual(shape(log), [
      { actorId: adminId, action: 'recordings.delete', targetType: 'user', targetId: secondId },
      { actorId: adminId, action: 'user.delete', targetType: 'user', targetId: secondId },
    ])
    assert.equal(log[1].meta.withRecordings, true)
  })

  test('S7: restriction create and remove, with only the hint and never the raw IP', async () => {
    const made = await admin.post('/admin/restrictions', { type: 'ip', value: '198.51.100.23', reason: 'Abuse' })
    assert.equal(made.status, 201)
    const id = made.body.data.id
    assert.equal((await admin.delete(`/admin/restrictions/${id}`)).status, 204)

    const log = await entries()
    assert.deepEqual(shape(log), [
      { actorId: adminId, action: 'restriction.create', targetType: 'restriction', targetId: id },
      { actorId: adminId, action: 'restriction.delete', targetType: 'restriction', targetId: id },
    ])
    assert.equal(log[0].meta.type, 'ip')
    assert.equal(log[0].meta.hint, '198.51.100.x')
    assert.equal(JSON.stringify(log).includes('198.51.100.23'), false)
  })

  test('S7: changing a message status', async () => {
    const sent = await new Client(base).post('/contact', { topic: 'recording-deletion', name: 'Audit', email: 'audit.msg@example.com', message: 'Delete my recordings' })
    assert.equal(sent.status, 201, JSON.stringify(sent.body))
    const { id } = sent.body.data
    assert.equal((await admin.patch(`/admin/messages/${id}`, { status: 'done' })).status, 200)

    const log = await entries()
    assert.deepEqual(shape(log), [{ actorId: adminId, action: 'message.status', targetType: 'message', targetId: id }])
    assert.equal(log[0].meta.status, 'done')
    assert.equal(log[0].meta.topic, 'recording-deletion')
  })

  test('S7: a refused action (404) writes nothing', async () => {
    assert.equal((await admin.delete('/categories/0123456789abcdef01234567')).status, 404)
    assert.equal((await admin.patch('/admin/users/0123456789abcdef01234567', { status: 'suspended' })).status, 404)
    assert.deepEqual(await entries(), [])
  })
})

describe('S7: separate admin accounts from ADMIN_EMAILS', () => {
  test('S7: the startup sync promotes a listed account, which then acts under its own name, and demotes it when removed from the list', async () => {
    const nida = await createVerifiedUser({ firstName: 'Nida', surname: 'Admin', email: 'nida.admin@example.com' })
    const nidaId = await idOf(nida)
    await AuditLog().deleteMany({})
    assert.equal((await nida.get('/admin/stats')).status, 403, 'not an admin before the sync')

    const promoted = await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL, 'nida.admin@example.com'] })
    assert.deepEqual(promoted.promoted, [nidaId])
    assert.equal((await nida.get('/admin/stats')).status, 200, 'the role is read again on the next request')

    const made = await nida.post('/categories', { label: 'Nida Category', tone: 'green' })
    assert.equal(made.status, 201)

    const demoted = await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL] })
    assert.deepEqual(demoted.demoted, [nidaId])
    assert.equal((await nida.get('/admin/stats')).status, 403)

    assert.deepEqual(shape(await entries()), [
      { actorId: null, action: 'admin.promote', targetType: 'user', targetId: nidaId },
      { actorId: nidaId, action: 'category.create', targetType: 'category', targetId: made.body.data.id },
      { actorId: null, action: 'admin.demote', targetType: 'user', targetId: nidaId },
    ])

    const listed = (await admin.get('/admin/audit')).body.data.entries
    assert.deepEqual(listed.map((entry) => [entry.action, entry.actor.name]), [
      ['admin.demote', 'System'],
      ['category.create', 'Nida Admin'],
      ['admin.promote', 'System'],
    ])
    assert.equal(listed[1].actor.id, nidaId)
    assert.equal(listed[0].actor.id, null)
  })
})

describe('S7: GET /admin/audit', () => {
  test('S7: the log is listed newest first, a page at a time', async () => {
    for (const label of ['Page A', 'Page B', 'Page C']) assert.equal((await admin.post('/categories', { label, tone: 'yellow' })).status, 201)

    const first = await admin.get('/admin/audit?limit=2')
    assert.equal(first.status, 200)
    assert.deepEqual({ page: first.body.data.page, limit: first.body.data.limit, total: first.body.data.total }, { page: 1, limit: 2, total: 3 })
    assert.deepEqual(first.body.data.entries.map((entry) => entry.meta.label), ['Page C', 'Page B'])
    const second = await admin.get('/admin/audit?limit=2&page=2')
    assert.deepEqual(second.body.data.entries.map((entry) => entry.meta.label), ['Page A'])
    const [entry] = first.body.data.entries
    assert.deepEqual(Object.keys(entry).sort(), ['action', 'actor', 'at', 'id', 'meta', 'targetId', 'targetType'])
    assert.deepEqual(entry.actor, { id: adminId, name: 'Admin Signpak' })
  })

  test('S7: the log filters by admin, by the system and by action', async () => {
    const omar = await createVerifiedUser({ firstName: 'Omar', surname: 'Admin', email: 'omar.admin@example.com' })
    const omarId = await idOf(omar)
    await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL, 'omar.admin@example.com'] })
    assert.equal((await omar.post('/categories', { label: 'Omar Filter', tone: 'red' })).status, 201)
    assert.equal((await admin.post('/categories', { label: 'Admin Filter', tone: 'red' })).status, 201)

    const byOmar = (await admin.get(`/admin/audit?actor=${omarId}`)).body.data
    assert.deepEqual(byOmar.entries.map((entry) => entry.meta.label), ['Omar Filter'])
    assert.equal(byOmar.total, 1)
    const bySystem = (await admin.get('/admin/audit?actor=system')).body.data
    assert.deepEqual(bySystem.entries.map((entry) => [entry.action, entry.targetId]), [['admin.promote', omarId]])
    const byAction = (await admin.get('/admin/audit?action=category.create')).body.data
    assert.deepEqual(byAction.entries.map((entry) => entry.meta.label), ['Admin Filter', 'Omar Filter'])
    const both = (await admin.get(`/admin/audit?actor=${adminId}&action=category.create`)).body.data
    assert.deepEqual(both.entries.map((entry) => entry.meta.label), ['Admin Filter'])

    await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL] })
  })

  test('S7: bad filters and page values are refused with 422', async () => {
    for (const query of ['actor=nobody', 'action=video.explode', 'page=0', 'limit=101', 'limit=abc']) {
      const res = await admin.get(`/admin/audit?${query}`)
      assert.equal(res.status, 422, query)
    }
  })

  test('S7: an admin who has since been deleted is shown as a deleted account', async () => {
    const gone = await createVerifiedUser({ firstName: 'Gone', surname: 'Admin', email: 'gone.admin@example.com' })
    const goneId = await idOf(gone)
    await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL, 'gone.admin@example.com'] })
    assert.equal((await gone.post('/categories', { label: 'Gone Category', tone: 'blue' })).status, 201)
    await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL] })
    assert.equal((await admin.delete(`/admin/users/${goneId}`)).status, 204)

    const listed = (await admin.get('/admin/audit?action=category.create')).body.data.entries
    assert.deepEqual(listed[0].actor, { id: goneId, name: 'Deleted account' })
  })

  test('S7: no entry holds an email address', async () => {
    await createVerifiedUser({ firstName: 'Mail', surname: 'Check', email: 'mail.check@example.com' })
    await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL, 'mail.check@example.com'] })
    await authService.syncAdmins({ emails: [process.env.ADMIN_EMAIL] })
    const all = await AuditLog().find().lean()
    assert.ok(all.length >= 2)
    assert.equal(JSON.stringify(all).includes('@'), false)
  })
})

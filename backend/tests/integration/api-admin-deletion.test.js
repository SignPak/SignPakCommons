import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { Client, recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'
import { createFakeDriveDriver } from '../support/fakeDriveDriver.js'

/**
 * C3: an admin acting on a deletion request, through the real HTTP stack, with recordings in
 * (fake) Google Drive as in production. FR13.13 is done when a deletion message leads to
 * "0 recordings left" for that person, in Drive and in MongoDB.
 */

const getContext = useApiContext({ after })
const primary = createFakeDriveDriver({ name: 'gdrive' })
const archive = createFakeDriveDriver({ name: 'gdrive-archive' })
let restoreStorage = () => {}
after(() => restoreStorage())

let base, admin, createVerifiedUser, mongoose, videos

const record = (client, video) => client.upload('/submissions', recordingForm({ videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' }))

/** A new contributor with `count` recordings (one per reference video, so no cooldown wait). */
async function contributorWith(label, count) {
  const email = `${label}@example.com`
  const client = await createVerifiedUser({ firstName: label, surname: 'Tester', email })
  for (const video of videos.slice(0, count)) {
    const res = await record(client, video)
    assert.equal(res.status, 201, JSON.stringify(res.body))
  }
  const id = (await client.get('/auth/session')).body.data.id
  return { client, email, id }
}

const submissionsOf = (userId) => mongoose.models.Submission.countDocuments({ user: userId })
const archivedKeysOf = async (userId) => (await mongoose.models.Submission.find({ user: userId })).map((s) => s.recording.key)

before(async () => {
  const { routeStorageForTests } = await import('../../src/services/storage/index.js')
  restoreStorage = routeStorageForTests({ primary, archive })
  ;({ base, admin, createVerifiedUser, mongoose } = await getContext())
  const category = (await admin.post('/categories', { label: 'Deletion', tone: 'yellow' })).body.data
  videos = []
  for (const title of ['One', 'Two', 'Three']) {
    const made = await admin.upload('/videos', videoForm({ title, categoryId: category.id, durationSec: '3' }))
    assert.equal(made.status, 201, JSON.stringify(made.body))
    videos.push(made.body.data)
  }
})

// Every request comes from 127.0.0.1; clear the per-sender deletion-request quota (S4) between cases.
beforeEach(() => mongoose.models.ContactSenderQuota.deleteMany({}))

describe('C3: deleting a contributor\'s recordings', () => {
  test('C3: deleting recordings removes the Drive files and the documents, and logs it without the email', async () => {
    const { email, id } = await contributorWith('dina', 2)
    const keys = await archivedKeysOf(id)
    assert.equal(keys.length, 2)
    for (const key of keys) assert.ok(archive.files.has(key), 'in Drive before')

    const res = await admin.delete(`/admin/users/${id}/submissions`)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.data, { deleted: 2, failed: [] })
    for (const key of keys) assert.equal(archive.files.has(key), false, 'gone from Drive')
    assert.equal(await submissionsOf(id), 0, 'gone from MongoDB')
    assert.equal(await mongoose.models.SubmissionCooldown.countDocuments({ user: id }), 0)

    const logs = await mongoose.models.DeletionLog.find({ userId: id }).lean()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].deleted, 2)
    assert.equal(logs[0].failed, 0)
    assert.match(logs[0].emailHash, /^[0-9a-f]{64}$/)
    assert.equal(JSON.stringify(logs[0]).toLowerCase().includes(email), false, 'no plain email in the log')
    assert.equal((await admin.get(`/admin/users/${id}/submissions`)).body.data.total, 0)
  })

  test('C3: a partial failure is reported, the failed document is kept, and a retry finishes', async () => {
    const { id } = await contributorWith('eman', 3)
    archive.failOn.remove = true // the next remove fails once
    const first = await admin.delete(`/admin/users/${id}/submissions`)
    assert.equal(first.status, 200)
    assert.equal(first.body.data.deleted, 2)
    assert.equal(first.body.data.failed.length, 1)
    assert.match(first.body.data.failed[0].id, /^[a-f\d]{24}$/)
    assert.equal(first.body.data.failed[0].reason, 'The file could not be deleted from storage. Try again.')
    assert.equal(await submissionsOf(id), 1, 'the failed one keeps its document')

    const retry = await admin.delete(`/admin/users/${id}/submissions`)
    assert.deepEqual(retry.body.data, { deleted: 1, failed: [] })
    assert.equal(await submissionsOf(id), 0)
    assert.equal(await mongoose.models.DeletionLog.countDocuments({ userId: id }), 2, 'each attempt is logged')
  })

  test('C3: deleting an account with withRecordings=true removes the recordings too', async () => {
    const { id, email } = await contributorWith('farah', 2)
    const keys = await archivedKeysOf(id)
    const res = await admin.delete(`/admin/users/${id}?withRecordings=true`)
    assert.equal(res.status, 204, JSON.stringify(res.body))
    assert.equal(await mongoose.models.User.countDocuments({ _id: id }), 0)
    assert.equal(await submissionsOf(id), 0)
    for (const key of keys) assert.equal(archive.files.has(key), false)
    const [log] = await mongoose.models.DeletionLog.find({ userId: id }).lean()
    assert.equal(log.accountDeleted, true)
    const [deleted] = await mongoose.models.DeletedAccount.find({ userId: id }).lean()
    assert.equal(deleted.by, 'admin')
    assert.equal(JSON.stringify(deleted).toLowerCase().includes(email), false)
  })

  test('C3: the account is kept (409) when a recording cannot be deleted', async () => {
    const { id } = await contributorWith('gul', 2)
    archive.failOn.remove = true
    const res = await admin.delete(`/admin/users/${id}?withRecordings=true`)
    assert.equal(res.status, 409)
    assert.match(res.body.error.message, /account was kept/)
    assert.equal(await mongoose.models.User.countDocuments({ _id: id }), 1)
    assert.equal(await submissionsOf(id), 1)
    assert.equal(await mongoose.models.DeletedAccount.countDocuments({ userId: id }), 0)
  })

  test('C3: plain account deletion still keeps the recordings, and records the account', async () => {
    const { id } = await contributorWith('hira', 1)
    assert.equal((await admin.delete(`/admin/users/${id}`)).status, 204)
    assert.equal(await submissionsOf(id), 1, 'recordings stay, as the consent notice says')
    assert.equal(await mongoose.models.DeletedAccount.countDocuments({ userId: id, by: 'admin' }), 1)
  })

  test('C3: a contributor deleting their own account is recorded too', async () => {
    const { client, id } = await contributorWith('iffat', 1)
    assert.equal((await client.delete('/users/me', { json: { password: 'password1' } })).status, 204)
    assert.equal(await mongoose.models.DeletedAccount.countDocuments({ userId: id, by: 'self' }), 1)
  })

  test('C3: an unknown contributor id gives 404', async () => {
    assert.equal((await admin.delete('/admin/users/0123456789abcdef01234567/submissions')).status, 404)
  })
})

describe('C3: finding whose recordings a request is about', () => {
  test('C3: the lookup finds a deleted account by email, and by message id, with its recordings', async () => {
    const { client, id, email } = await contributorWith('jamila', 2)
    assert.equal((await client.delete('/users/me', { json: { password: 'password1' } })).status, 204)
    const sent = await new Client(base).post('/contact', { topic: 'recording-deletion', name: 'Jamila', email: email.toUpperCase(), message: 'Delete my recordings' })
    assert.equal(sent.status, 201)

    const byEmail = await admin.get(`/admin/deletion-lookup?email=${encodeURIComponent(` ${email.toUpperCase()} `)}`)
    assert.equal(byEmail.status, 200, JSON.stringify(byEmail.body))
    assert.deepEqual(byEmail.body.data.matches.map((m) => [m.kind, m.userId, m.submissionCount]), [['deleted', id, 2]])

    const byMessage = await admin.get(`/admin/deletion-lookup?messageId=${sent.body.data.id}`)
    assert.deepEqual(byMessage.body.data, byEmail.body.data)

    // Then the admin deletes them: the account is gone, the recordings were not.
    const removed = await admin.delete(`/admin/users/${id}/submissions?requestMessageId=${sent.body.data.id}`)
    assert.deepEqual(removed.body.data, { deleted: 2, failed: [] })
    const [log] = await mongoose.models.DeletionLog.find({ userId: id }).lean()
    assert.equal(String(log.requestMessageId), sent.body.data.id)
    assert.match(log.emailHash, /^[0-9a-f]{64}$/, 'the hash comes from the DeletedAccount record')
  })

  test('C3: the lookup finds a current account, and both kinds after a re-signup', async () => {
    const { client, email } = await contributorWith('kanwal', 1)
    const first = (await admin.get(`/admin/deletion-lookup?email=${email}`)).body.data.matches
    assert.deepEqual(first.map((m) => [m.kind, m.submissionCount, m.email]), [['user', 1, email]])

    assert.equal((await client.delete('/users/me', { json: { password: 'password1' } })).status, 204)
    await createVerifiedUser({ firstName: 'kanwal', surname: 'Again', email })
    const both = (await admin.get(`/admin/deletion-lookup?email=${email}`)).body.data.matches
    assert.deepEqual(both.map((m) => [m.kind, m.submissionCount]), [['user', 0], ['deleted', 1]])
  })

  test('C3: the lookup needs exactly one of email or message id', async () => {
    assert.equal((await admin.get('/admin/deletion-lookup')).status, 422)
    assert.equal((await admin.get('/admin/deletion-lookup?email=a@b.co&messageId=0123456789abcdef01234567')).status, 422)
    assert.equal((await admin.get('/admin/deletion-lookup?messageId=0123456789abcdef01234567')).status, 404)
  })

  test('C3: a contributor\'s submissions are listed a page at a time', async () => {
    const { id } = await contributorWith('lubna', 3)
    const first = await admin.get(`/admin/users/${id}/submissions?limit=2`)
    assert.equal(first.status, 200)
    assert.equal(first.body.data.total, 3)
    assert.equal(first.body.data.items.length, 2)
    assert.ok(first.body.data.nextCursor)
    const second = await admin.get(`/admin/users/${id}/submissions?limit=2&cursor=${first.body.data.nextCursor}`)
    assert.equal(second.body.data.items.length, 1)
    assert.equal(second.body.data.nextCursor, null)
    const ids = [...first.body.data.items, ...second.body.data.items].map((s) => s.id)
    assert.equal(new Set(ids).size, 3, 'no row twice')
  })
})

describe('C3: the admin inbox', () => {
  test('C3: messages can be filtered by topic, status and verified', async () => {
    await new Client(base).post('/contact', { topic: 'recording-deletion', name: 'Filter', email: 'filter-unverified@example.com', message: 'Delete' })
    const deletions = (await admin.get('/admin/messages?topic=recording-deletion')).body.data
    assert.ok(deletions.length >= 1)
    assert.ok(deletions.every((m) => m.topic === 'recording-deletion'))
    const unverified = (await admin.get('/admin/messages?verified=false')).body.data
    assert.ok(unverified.every((m) => m.verified === false))
    assert.ok(unverified.some((m) => m.email === 'filter-unverified@example.com'))
    assert.equal((await admin.get('/admin/messages?verified=maybe')).status, 422)
    assert.equal((await admin.get('/admin/messages?status=closed')).status, 422)
  })

  test('C3: marking a message done or rejected records who and when; reopening clears it', async () => {
    const sent = await new Client(base).post('/contact', { topic: 'recording-deletion', name: 'Status', email: 'status@example.com', message: 'Delete' })
    const { id } = sent.body.data
    const adminId = (await admin.get('/auth/session')).body.data.id

    const done = await admin.patch(`/admin/messages/${id}`, { status: 'done' })
    assert.equal(done.status, 200)
    assert.equal(done.body.data.status, 'done')
    assert.equal(done.body.data.handledBy, adminId)
    assert.ok(Date.now() - new Date(done.body.data.handledAt).getTime() < 10_000)
    assert.ok((await admin.get('/admin/messages?status=done')).body.data.some((m) => m.id === id))

    assert.equal((await admin.patch(`/admin/messages/${id}`, { status: 'rejected' })).body.data.status, 'rejected')
    const reopened = await admin.patch(`/admin/messages/${id}`, { status: 'open' })
    assert.equal(reopened.body.data.handledAt, null)
    assert.equal(reopened.body.data.handledBy, null)

    assert.equal((await admin.patch(`/admin/messages/${id}`, { status: 'archived' })).status, 422)
    assert.equal((await admin.patch('/admin/messages/0123456789abcdef01234567', { status: 'done' })).status, 404)
  })
})

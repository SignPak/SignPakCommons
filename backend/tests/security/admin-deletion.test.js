import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * C3: deletion records must never hold an email address, only its keyed hash, and the deletion
 * routes must not accept query operators in place of values.
 */

const getContext = useApiContext({ after })
let admin, createVerifiedUser, mongoose

before(async () => {
  ;({ admin, createVerifiedUser, mongoose } = await getContext())
})

describe('security: deletion records (C3)', () => {
  test('C3: no DeletionLog or DeletedAccount document contains the email, in any field', async () => {
    const email = 'private.person@example.com'
    const category = (await admin.post('/categories', { label: 'Private', tone: 'yellow' })).body.data
    const video = (await admin.upload('/videos', videoForm({ title: 'Private', categoryId: category.id, durationSec: '3' }))).body.data
    const person = await createVerifiedUser({ firstName: 'Private', surname: 'Person', email })
    assert.equal((await person.upload('/submissions', recordingForm({ videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' }))).status, 201)
    const id = (await person.get('/auth/session')).body.data.id

    assert.equal((await admin.delete(`/admin/users/${id}?withRecordings=true`)).status, 204)

    const stored = [
      ...await mongoose.models.DeletionLog.find({}).lean(),
      ...await mongoose.models.DeletedAccount.find({}).lean(),
    ]
    assert.ok(stored.length >= 2)
    const text = JSON.stringify(stored).toLowerCase()
    for (const part of [email, 'private.person', 'private person']) {
      assert.equal(text.includes(part), false, `"${part}" must not be stored`)
    }
  })

  test('C3: query operators are refused in place of an email, an id or a cursor', async () => {
    const ID = '0123456789abcdef01234567'
    for (const url of [
      '/admin/deletion-lookup?email[$ne]=x',
      '/admin/deletion-lookup?messageId[$gt]=',
      `/admin/users/${ID}/submissions?cursor[$gt]=`,
      '/admin/messages?verified[$ne]=true',
    ]) {
      const res = await admin.get(url)
      assert.equal(res.status, 422, url)
      assert.equal(res.body.error.code, 'VALIDATION_ERROR')
    }
    assert.equal((await admin.delete(`/admin/users/${ID}/submissions?requestMessageId[$ne]=x`)).status, 422)
  })
})

import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { Client, filesIn, jpeg, mp4, recordingForm, videoForm, webm } from './helpers.js'
import { useApiContext } from './apiContext.js'

const getContext = useApiContext()
let base, admin, contributor, other, createVerifiedUser, deliveredCodes, contactDeliveries
let ContactDailyQuota, Submission, SubmissionCooldown, storageService, authService, submissionRepo
let daily, work, video1, video2, draft, submission, eveSession

before(() => {
  const context = getContext()
  ;({ base, admin, contributor, other, createVerifiedUser, deliveredCodes, contactDeliveries, ContactDailyQuota, Submission, SubmissionCooldown, storageService, authService, submissionRepo } = context)
})

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

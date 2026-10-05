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

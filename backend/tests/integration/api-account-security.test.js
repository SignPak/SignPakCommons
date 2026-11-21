import assert from 'node:assert/strict'
import { after, afterEach, before, describe, mock, test } from 'node:test'
import bcrypt from 'bcrypt'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * Phase 6, account security, through the real HTTP stack: the lockout (S2), logout and password
 * change ending sessions (S6), unfinished sign-ups (S9, B3), verified-only counts (B2) and the
 * 10-minute code expiry.
 */

const getContext = useApiContext({ after })
let base, admin, createVerifiedUser, deliveredCodes, mongoose

before(async () => {
  ;({ base, admin, createVerifiedUser, deliveredCodes, mongoose } = await getContext())
})

const users = () => mongoose.models.User
const login = (client, email, password = 'password1') => client.post('/auth/login', { email, password })
const fields = (email) => users().findOne({ email }).select('+failedLoginCount +lockedUntil +signupExpiresAt +emailVerificationSentAt').lean()
const signup = (client, email, overrides = {}) => client.post('/auth/signup', { firstName: 'Nida', surname: 'First', email, password: 'password1', ...overrides })
const code = (email) => deliveredCodes.get(`${email}:email-verification`)

describe('S2: account lockout', () => {
  test('S2: five wrong passwords lock the account, even against the right password', async () => {
    await createVerifiedUser({ firstName: 'Lock', surname: 'Out', email: 'lock@example.com' })
    const c = new Client(base)
    for (let n = 1; n <= 4; n += 1) assert.equal((await login(c, 'lock@example.com', 'wrong-password')).status, 401, `attempt ${n}`)
    const fifth = await login(c, 'lock@example.com', 'wrong-password')
    assert.equal(fifth.status, 429)
    assert.equal(fifth.body.error.code, 'ACCOUNT_LOCKED')
    assert.equal(fifth.body.error.message, 'Too many failed attempts. Try again in 15 minutes.')
    assert.equal((await login(c, 'lock@example.com')).status, 429, 'the right password is refused while locked')

    const { lockedUntil } = await fields('lock@example.com')
    const minutes = (new Date(lockedUntil).getTime() - Date.now()) / 60_000
    assert.ok(minutes > 14 && minutes <= 15, `locked for ${minutes} minutes`)
  })

  test('S2: once the lock has passed, logging in works and clears it', async () => {
    await users().updateOne({ email: 'lock@example.com' }, { $set: { lockedUntil: new Date(Date.now() - 1000) } })
    assert.equal((await login(new Client(base), 'lock@example.com')).status, 200)
    const after = await fields('lock@example.com')
    assert.equal(after.failedLoginCount, 0)
    assert.equal(after.lockedUntil, null)
  })

  test('S2: a successful login resets the count', async () => {
    await createVerifiedUser({ firstName: 'Reset', surname: 'Count', email: 'resetcount@example.com' })
    const c = new Client(base)
    for (let n = 1; n <= 4; n += 1) await login(c, 'resetcount@example.com', 'wrong-password')
    assert.equal((await login(c, 'resetcount@example.com')).status, 200)
    for (let n = 1; n <= 4; n += 1) assert.equal((await login(c, 'resetcount@example.com', 'wrong-password')).status, 401)
  })

  test('S2: a password reset ends a lockout', async () => {
    await createVerifiedUser({ firstName: 'Reset', surname: 'Lock', email: 'resetlock@example.com' })
    const c = new Client(base)
    for (let n = 1; n <= 5; n += 1) await login(c, 'resetlock@example.com', 'wrong-password')
    assert.equal((await login(c, 'resetlock@example.com')).status, 429)
    assert.equal((await c.post('/auth/forgot-password', { email: 'resetlock@example.com' })).status, 200)
    let resetCode
    for (let n = 0; n < 50 && !resetCode; n += 1) {
      resetCode = deliveredCodes.get('resetlock@example.com:password-reset')
      if (!resetCode) await new Promise((resolve) => setTimeout(resolve, 20))
    }
    const reset = await c.post('/auth/reset-password', { email: 'resetlock@example.com', code: resetCode, password: 'newpassword1', confirmPassword: 'newpassword1' })
    assert.equal(reset.status, 200, JSON.stringify(reset.body))
    assert.equal((await login(c, 'resetlock@example.com', 'newpassword1')).status, 200)
  })
})

describe('S6: ending sessions', () => {
  test('S6: after logout the old token no longer works, even if replayed', async () => {
    const c = await createVerifiedUser({ firstName: 'Old', surname: 'Token', email: 'oldtoken@example.com' })
    const stolen = new Client(base)
    stolen.cookies = new Map(c.cookies) // a copy of the cookie, as an attacker would keep it
    assert.equal((await stolen.get('/users/me')).status, 200)
    assert.equal((await c.post('/auth/logout')).status, 204)
    assert.equal((await stolen.get('/users/me')).status, 401)
  })

  test('S6: logging out on one device ends the session on every other device', async () => {
    await createVerifiedUser({ firstName: 'Two', surname: 'Devices', email: 'twodevices@example.com' })
    const laptop = new Client(base)
    const phone = new Client(base)
    assert.equal((await login(laptop, 'twodevices@example.com')).status, 200)
    assert.equal((await login(phone, 'twodevices@example.com')).status, 200)
    assert.equal((await phone.post('/auth/logout')).status, 204)
    assert.equal((await laptop.get('/users/me')).status, 401)
    assert.equal((await login(laptop, 'twodevices@example.com')).status, 200, 'logging in again works')
  })

  test('S6: logout without a session still answers 204', async () => {
    assert.equal((await new Client(base).post('/auth/logout')).status, 204)
  })
})

describe('password change while logged in', () => {
  test('a wrong current password is refused with 401 and changes nothing', async () => {
    const c = await createVerifiedUser({ firstName: 'Pass', surname: 'Wrong', email: 'passwrong@example.com' })
    const res = await c.post('/users/me/password', { currentPassword: 'not-it', password: 'newpassword1', confirmPassword: 'newpassword1' })
    assert.equal(res.status, 401)
    assert.equal(res.body.error.message, 'Your current password is not correct.')
    assert.equal((await login(new Client(base), 'passwrong@example.com')).status, 200)
  })

  test('a mismatched confirmation or the same password is refused with 422', async () => {
    const c = await createVerifiedUser({ firstName: 'Pass', surname: 'Same', email: 'passsame@example.com' })
    const mismatch = await c.post('/users/me/password', { currentPassword: 'password1', password: 'newpassword1', confirmPassword: 'other' })
    assert.equal(mismatch.status, 422)
    assert.equal(mismatch.body.error.fields.confirmPassword, 'Passwords do not match.')
    const same = await c.post('/users/me/password', { currentPassword: 'password1', password: 'password1', confirmPassword: 'password1' })
    assert.equal(same.status, 422)
    assert.ok(same.body.error.fields.password)
    const short = await c.post('/users/me/password', { currentPassword: 'password1', password: 'short', confirmPassword: 'short' })
    assert.equal(short.body.error.fields.password, 'Use at least 8 characters.')
  })

  test('S6: a password change keeps this session, ends every other one, and the new password works', async () => {
    const c = await createVerifiedUser({ firstName: 'Pass', surname: 'Change', email: 'passchange@example.com' })
    const other = new Client(base)
    assert.equal((await login(other, 'passchange@example.com')).status, 200)
    const res = await c.post('/users/me/password', { currentPassword: 'password1', password: 'newpassword1', confirmPassword: 'newpassword1' })
    assert.equal(res.status, 204, JSON.stringify(res.body))
    assert.equal((await c.get('/users/me')).status, 200, 'this device stays signed in')
    assert.equal((await other.get('/users/me')).status, 401, 'other sessions end')
    assert.equal((await login(new Client(base), 'passchange@example.com')).status, 401, 'the old password no longer works')
    assert.equal((await login(new Client(base), 'passchange@example.com', 'newpassword1')).status, 200)
  })
})

describe('S9 and B3: unfinished sign-ups', () => {
  test('S9: a new sign-up expires 24 hours later, and finishing it removes the expiry', async () => {
    const c = new Client(base)
    assert.equal((await signup(c, 'expiry@example.com')).status, 201)
    const pending = await fields('expiry@example.com')
    const hours = (new Date(pending.signupExpiresAt).getTime() - Date.now()) / 3_600_000
    assert.ok(hours > 23.9 && hours <= 24, `expires in ${hours} hours`)

    const verified = await c.post('/auth/verify-email', { email: 'expiry@example.com', code: code('expiry@example.com'), password: 'password1' })
    const { CONSENT_VERSION } = await import('../../src/config/constants.js')
    assert.equal((await c.post('/auth/consent', { consentToken: verified.body.data.consentToken, accepted: true, version: CONSENT_VERSION })).status, 200)
    assert.equal((await fields('expiry@example.com')).signupExpiresAt, null)
  })

  test('S9: sign-ups from before the TTL index get an expiry 24 h after they were created', async () => {
    const createdAt = new Date(Date.now() - 2 * 3_600_000)
    await users().collection.insertOne({ email: 'legacy@example.com', firstName: 'Old', surname: 'Pending', passwordHash: 'x', role: 'user', emailVerified: false, status: 'active', authVersion: 0, createdAt, updatedAt: createdAt })
    const { userRepo } = await import('../../src/repositories/userRepo.js')
    await userRepo.backfillSignupExpiry()
    assert.equal(new Date((await fields('legacy@example.com')).signupExpiresAt).getTime(), createdAt.getTime() + 24 * 3_600_000)
    const again = await userRepo.backfillSignupExpiry()
    assert.equal(again.modifiedCount, 0, 'running it again changes nothing')
    assert.equal(await users().countDocuments({ role: 'admin', signupExpiresAt: { $ne: null } }), 0, 'never an admin')
  })

  test('B3: signing up again with an unfinished email succeeds, updates the details and restarts the expiry', async () => {
    const first = new Client(base)
    assert.equal((await signup(first, 'again@example.com')).status, 201)
    const firstCode = code('again@example.com')
    await users().updateOne({ email: 'again@example.com' }, { $set: { signupExpiresAt: new Date(Date.now() + 60_000) } })

    const second = await signup(new Client(base), 'again@example.com', { firstName: 'Nadia', surname: 'Second', password: 'secondpass1' })
    assert.equal(second.status, 201)
    assert.deepEqual(second.body.data, { email: 'again@example.com', verificationEmailSent: true })
    const doc = await fields('again@example.com')
    assert.equal(doc.firstName, 'Nadia')
    assert.ok(new Date(doc.signupExpiresAt).getTime() - Date.now() > 23 * 3_600_000, 'the 24 hours restart')
    assert.equal(code('again@example.com'), firstCode, 'within a minute no new code is sent; the first one still works')

    // Outside the minute a new code goes out.
    await users().updateOne({ email: 'again@example.com' }, { $set: { emailVerificationSentAt: new Date(Date.now() - 61_000) } })
    assert.equal((await signup(new Client(base), 'again@example.com', { password: 'secondpass1' })).status, 201)
    assert.notEqual(code('again@example.com'), firstCode)
  })

  test('B3: the password is checked with the code, so only the person who chose it can finish', async () => {
    const owner = new Client(base)
    assert.equal((await signup(owner, 'owner@example.com', { password: 'ownerpass1' })).status, 201)
    // Someone else signs up again with the same address and their own password.
    assert.equal((await signup(new Client(base), 'owner@example.com', { password: 'attacker1' })).status, 201)
    const ownerCode = code('owner@example.com')

    const withOwnPassword = await owner.post('/auth/verify-email', { email: 'owner@example.com', code: ownerCode, password: 'ownerpass1' })
    assert.equal(withOwnPassword.status, 422, 'the owner cannot be handed the other password')
    assert.ok(withOwnPassword.body.error.fields.password)

    // The owner signs up again with their own password, then finishes with it.
    await users().updateOne({ email: 'owner@example.com' }, { $set: { emailVerificationSentAt: new Date(Date.now() - 61_000) } })
    assert.equal((await signup(owner, 'owner@example.com', { password: 'ownerpass1' })).status, 201)
    const done = await owner.post('/auth/verify-email', { email: 'owner@example.com', code: code('owner@example.com'), password: 'ownerpass1' })
    assert.equal(done.status, 200)
  })

  test('B3: a finished account still answers 409 to a new sign-up', async () => {
    await createVerifiedUser({ firstName: 'Done', surname: 'Already', email: 'finished@example.com' })
    const res = await signup(new Client(base), 'finished@example.com')
    assert.equal(res.status, 409)
  })

  test('codes expire after 10 minutes', async () => {
    const c = new Client(base)
    assert.equal((await signup(c, 'tenmin@example.com')).status, 201)
    const { emailVerificationExpiresAt } = await users().findOne({ email: 'tenmin@example.com' }).select('+emailVerificationExpiresAt').lean()
    const minutes = (new Date(emailVerificationExpiresAt).getTime() - Date.now()) / 60_000
    assert.ok(minutes > 9.9 && minutes <= 10, `expires in ${minutes} minutes`)
    await users().updateOne({ email: 'tenmin@example.com' }, { $set: { emailVerificationExpiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await c.post('/auth/verify-email', { email: 'tenmin@example.com', code: code('tenmin@example.com'), password: 'password1' })).status, 400)
  })
})

describe('B3: a re-signup between verify and consent (fixes after verification)', () => {
  const consent = async (client, consentToken) => {
    const { CONSENT_VERSION } = await import('../../src/config/constants.js')
    return client.post('/auth/consent', { consentToken, accepted: true, version: CONSENT_VERSION })
  }

  test('B3: a consent token from before a re-signup is refused, and the other person never gets an account', async () => {
    // Sara signs up and verifies: she now holds a consent token.
    const sara = new Client(base)
    assert.equal((await signup(sara, 'sara.b3@example.com', { firstName: 'Sara', surname: 'Owner', password: 'sarapass1' })).status, 201)
    const verified = await sara.post('/auth/verify-email', { email: 'sara.b3@example.com', code: code('sara.b3@example.com'), password: 'sarapass1' })
    assert.equal(verified.status, 200)
    const saraToken = verified.body.data.consentToken

    // Someone else signs up again with her email, their own name and password (inside the
    // resend window, so no email goes out).
    const attacker = new Client(base)
    const again = await signup(attacker, 'sara.b3@example.com', { firstName: 'Mallory', surname: 'Other', password: 'attacker1' })
    assert.equal(again.status, 201)

    // Sara's consent with her (now stale) token is refused.
    const res = await consent(sara, saraToken)
    assert.equal(res.status, 400)
    assert.equal(res.body.error.message, 'This sign-up step has expired. Verify your email again to continue.')
    assert.equal(res.setCookie.length, 0, 'no session is started')
    const doc = await users().findOne({ email: 'sara.b3@example.com' }).lean()
    assert.equal(doc.emailVerified, false, 'no account was finished with the other person\'s details')
    assert.equal((await login(new Client(base), 'sara.b3@example.com', 'attacker1')).status, 401, 'the other person cannot log in')

    // Sara signs up again, verifies with the new code and her password, consents and logs in.
    await users().updateOne({ email: 'sara.b3@example.com' }, { $set: { emailVerificationSentAt: new Date(Date.now() - 61_000) } })
    assert.equal((await signup(sara, 'sara.b3@example.com', { firstName: 'Sara', surname: 'Owner', password: 'sarapass1' })).status, 201)
    const reverified = await sara.post('/auth/verify-email', { email: 'sara.b3@example.com', code: code('sara.b3@example.com'), password: 'sarapass1' })
    assert.equal(reverified.status, 200)
    const accepted = await consent(sara, reverified.body.data.consentToken)
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.data.firstName, 'Sara')
    assert.equal((await login(new Client(base), 'sara.b3@example.com', 'sarapass1')).status, 200)
    assert.equal((await login(new Client(base), 'sara.b3@example.com', 'attacker1')).status, 401)
  })

  test('B3: declining with a token from before a re-signup is refused and the sign-up is kept', async () => {
    const owner = new Client(base)
    assert.equal((await signup(owner, 'decline.b3@example.com')).status, 201)
    const verified = await owner.post('/auth/verify-email', { email: 'decline.b3@example.com', code: code('decline.b3@example.com'), password: 'password1' })
    const staleToken = verified.body.data.consentToken
    assert.equal((await signup(new Client(base), 'decline.b3@example.com', { password: 'otherpass1' })).status, 201)

    const declined = await owner.post('/auth/decline-consent', { consentToken: staleToken })
    assert.equal(declined.status, 400)
    assert.equal(declined.body.error.message, 'This sign-up step has expired. Verify your email again to continue.')
    assert.equal(await users().countDocuments({ email: 'decline.b3@example.com' }), 1, 'the pending sign-up is not removed')
  })
})

describe('B3: a re-signup racing consent or decline (second fixes after verification)', () => {
  const EXPIRED = 'This sign-up step has expired. Verify your email again to continue.'
  const consent = async (client, consentToken) => {
    const { CONSENT_VERSION } = await import('../../src/config/constants.js')
    return client.post('/auth/consent', { consentToken, accepted: true, version: CONSENT_VERSION })
  }
  // The owner signs up and verifies, so she holds a consent token for the current version.
  const ownerWithToken = async (email) => {
    const owner = new Client(base)
    assert.equal((await signup(owner, email, { firstName: 'Owner', surname: 'Real', password: 'ownerpass1' })).status, 201)
    const verified = await owner.post('/auth/verify-email', { email, code: code(email), password: 'ownerpass1' })
    assert.equal(verified.status, 200)
    return { owner, token: verified.body.data.consentToken }
  }
  const attackerSignup = (email) => signup(new Client(base), email, { firstName: 'Mallory', surname: 'Other', password: 'attacker1' })
  // A gate: `entered` resolves when the held call reaches hold(), and release() lets it carry on.
  const gate = () => {
    let reached, release
    const entered = new Promise((resolve) => { reached = resolve })
    const opened = new Promise((resolve) => { release = resolve })
    return { entered, release, hold: async () => { reached(); await opened } }
  }
  // Holds the first userRepo.findById (the fast check in pendingSignup) after it has read the account.
  const holdFirstFindById = (held) => {
    const realFindById = userRepo.findById
    let first = true
    mock.method(userRepo, 'findById', async (...args) => {
      const doc = await realFindById.apply(userRepo, args)
      if (first) { first = false; await held.hold() }
      return doc
    })
  }
  let userRepo
  before(async () => { ({ userRepo } = await import('../../src/repositories/userRepo.js')) })
  afterEach(() => mock.restoreAll())

  test('B3: consent that lands while a re-signup is hashing wins; the re-signup gets 409 and changes nothing', async () => {
    const email = 'race.consent@example.com'
    const { owner, token } = await ownerWithToken(email)
    const realHash = bcrypt.hash
    const held = gate()
    mock.method(bcrypt, 'hash', async (...args) => { await held.hold(); return realHash.apply(bcrypt, args) })

    const resignup = attackerSignup(email) // reads the pending account, then waits inside bcrypt.hash
    await held.entered
    const accepted = await consent(owner, token)
    held.release()
    const again = await resignup

    assert.equal(accepted.status, 200)
    assert.equal(again.status, 409)
    assert.equal(again.body.error.message, 'An account with this email already exists. Log in instead.')
    mock.restoreAll()
    assert.equal((await login(new Client(base), email, 'ownerpass1')).status, 200, 'the owner logs in with her password')
    assert.equal((await login(new Client(base), email, 'attacker1')).status, 401, 'the other person cannot')
    const doc = await users().findOne({ email }).lean()
    assert.equal(doc.firstName, 'Owner')
    assert.equal(doc.surname, 'Real')
    assert.equal(doc.emailVerified, true)
  })

  test('B3: a re-signup that commits between consent\'s check and its write wins; consent gets 400', async () => {
    const email = 'race.resignup@example.com'
    const { owner, token } = await ownerWithToken(email)
    const held = gate()
    holdFirstFindById(held)

    const consenting = consent(owner, token) // has read the account and checked v, then waits
    await held.entered
    assert.equal((await attackerSignup(email)).status, 201, 'the re-signup commits first')
    held.release()
    const res = await consenting

    assert.equal(res.status, 400)
    assert.equal(res.body.error.message, EXPIRED)
    assert.equal(res.setCookie.length, 0, 'no session is started')
    mock.restoreAll()
    const doc = await users().findOne({ email }).lean()
    assert.equal(doc.emailVerified, false, 'the account is not finished')
    assert.equal((await login(new Client(base), email, 'ownerpass1')).status, 401, 'the owner cannot log in')
    assert.equal((await login(new Client(base), email, 'attacker1')).status, 401, 'nor can the other person')
  })

  test('B3: a re-signup that commits between decline\'s check and its delete wins; decline gets 400 and the sign-up is kept', async () => {
    const email = 'race.decline@example.com'
    const { owner, token } = await ownerWithToken(email)
    const held = gate()
    holdFirstFindById(held)

    const declining = owner.post('/auth/decline-consent', { consentToken: token })
    await held.entered
    assert.equal((await attackerSignup(email)).status, 201, 'the re-signup commits first')
    held.release()
    const res = await declining

    assert.equal(res.status, 400)
    assert.equal(res.body.error.message, EXPIRED)
    mock.restoreAll()
    assert.equal(await users().countDocuments({ email }), 1, 'the pending sign-up is kept')
  })

  test('B3: stress, 10 re-signups racing consent: exactly one wins every time and the other person never logs in', async () => {
    const realHash = bcrypt.hash
    for (let i = 0; i < 10; i += 1) {
      const email = `race.stress${i}@example.com`
      const { owner, token } = await ownerWithToken(email)
      // Even iterations hash at the production cost (12 rounds, about 250 ms), odd ones at the
      // test cost, so more than one interleaving gets exercised.
      if (i % 2 === 0) mock.method(bcrypt, 'hash', (password) => realHash.call(bcrypt, password, 12))
      const [again, accepted] = await Promise.all([attackerSignup(email), consent(owner, token)])
      mock.restoreAll()

      const consentWon = accepted.status === 200 && again.status === 409
      const resignupWon = accepted.status === 400 && again.status === 201
      assert.ok(consentWon !== resignupWon, `iteration ${i}: consent ${accepted.status}, re-signup ${again.status}`)
      assert.notEqual((await login(new Client(base), email, 'attacker1')).status, 200, `iteration ${i}: the other person logged in`)
      assert.equal((await login(new Client(base), email, 'ownerpass1')).status, consentWon ? 200 : 401, `iteration ${i}: owner login`)
      const doc = await users().findOne({ email }).lean()
      assert.equal(doc.emailVerified, consentWon, `iteration ${i}: emailVerified`)
      assert.equal(doc.firstName, consentWon ? 'Owner' : 'Mallory', `iteration ${i}: name`)
    }
  })

  test('B3: the conditional writes treat an account with no authVersion field as version 0', async () => {
    const email = 'noversion@example.com'
    assert.equal((await signup(new Client(base), email)).status, 201)
    const unsetVersion = () => users().collection.updateOne({ email }, { $unset: { authVersion: '' } })
    await unsetVersion()
    const { _id } = await users().findOne({ email }).lean()

    assert.equal(await userRepo.completePendingSignup(_id, 1, { consent: { acceptedAt: new Date(), version: 'x' } }), null, 'version 1 does not match')
    const updated = await userRepo.updatePendingSignup(_id, 0, { firstName: 'Matched' })
    assert.equal(updated.firstName, 'Matched', 'version 0 matches the missing field')
    assert.equal(updated.authVersion, 1, 'the update bumps the version')
    await unsetVersion()
    assert.equal((await userRepo.removePendingSignup(_id, 0)).deletedCount, 1)
  })
})

describe('S2: password change counts toward the lockout (fixes after verification)', () => {
  test('S2: five wrong current passwords lock the account, the session stays, and login is locked too', async () => {
    const c = await createVerifiedUser({ firstName: 'Change', surname: 'Lock', email: 'changelock@example.com' })
    const wrong = () => c.post('/users/me/password', { currentPassword: 'not-it', password: 'newpassword1', confirmPassword: 'newpassword1' })
    for (let n = 1; n <= 4; n += 1) assert.equal((await wrong()).status, 401, `attempt ${n}`)
    const fifth = await wrong()
    assert.equal(fifth.status, 429)
    assert.equal(fifth.body.error.code, 'ACCOUNT_LOCKED')

    const right = await c.post('/users/me/password', { currentPassword: 'password1', password: 'newpassword1', confirmPassword: 'newpassword1' })
    assert.equal(right.status, 429, 'locked even with the right current password')
    assert.equal((await login(new Client(base), 'changelock@example.com')).status, 429, 'login is locked too')
    assert.equal((await c.get('/users/me')).status, 200, 'the existing session is not ended by the lock')
  })
})

describe('B2: contributor counts', () => {
  test('B2: public and admin stats count only contributors who finished sign-up', async () => {
    const before = (await new Client(base).get('/public/stats')).body.data.contributors
    const beforeAdmin = (await admin.get('/admin/stats')).body.data.totals.contributors
    assert.equal(before, await users().countDocuments({ role: 'user', emailVerified: true }))
    assert.equal(beforeAdmin, before)

    assert.equal((await signup(new Client(base), 'notcounted@example.com')).status, 201)
    assert.equal((await new Client(base).get('/public/stats')).body.data.contributors, before, 'an unfinished sign-up is not counted')
    assert.equal((await admin.get('/admin/stats')).body.data.totals.contributors, beforeAdmin)

    await createVerifiedUser({ firstName: 'Is', surname: 'Counted', email: 'counted@example.com' })
    assert.equal((await new Client(base).get('/public/stats')).body.data.contributors, before + 1)
  })
})

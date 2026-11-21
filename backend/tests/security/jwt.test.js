import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import jwt from 'jsonwebtoken'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * FIX-PLAN 4.5: session tokens. A token is only accepted when it is signed with JWT_SECRET
 * using HS256, not expired, and carries the account's current authVersion, so logout (S6) and
 * a password change end it.
 */

const getContext = useApiContext({ after })
let base, createVerifiedUser, mongoose, userId

const COOKIE = 'signpak_token'
const SECRET = process.env.JWT_SECRET

const withToken = (token) => {
  const client = new Client(base)
  client.cookies.set(COOKIE, token)
  return client
}
const me = (token) => withToken(token).get('/users/me')

before(async () => {
  ;({ base, createVerifiedUser, mongoose } = await getContext())
  const client = await createVerifiedUser({ firstName: 'Jay', surname: 'Token', email: 'jwt@example.com' })
  userId = (await client.get('/auth/session')).body.data.id
})

const currentVersion = async () => (await mongoose.models.User.findById(userId).lean()).authVersion

describe('security: session tokens (JWT)', () => {
  test('S6: a correctly signed token for the current version is accepted (control)', async () => {
    const token = jwt.sign({ authVersion: await currentVersion() }, SECRET, { subject: userId, expiresIn: '1h', algorithm: 'HS256' })
    assert.equal((await me(token)).status, 200)
  })

  test('S6: a tampered token is rejected', async () => {
    const token = jwt.sign({ authVersion: await currentVersion() }, SECRET, { subject: userId, expiresIn: '1h', algorithm: 'HS256' })
    const [header, , signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: userId, authVersion: await currentVersion(), role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
    assert.equal((await me(`${header}.${forged}.${signature}`)).status, 401)
    assert.equal((await me(jwt.sign({ authVersion: await currentVersion() }, 'a-different-secret-a-different-secret', { subject: userId, algorithm: 'HS256' }))).status, 401)
  })

  test('S6: an expired token is rejected', async () => {
    const token = jwt.sign({ authVersion: await currentVersion(), exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { subject: userId, algorithm: 'HS256' })
    assert.equal((await me(token)).status, 401)
  })

  test('S6: an unsigned (alg: none) token is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: userId, authVersion: await currentVersion(), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
    assert.equal((await me(`${header}.${payload}.`)).status, 401)
  })

  test('S6: the token from before a logout is rejected afterwards', async () => {
    const client = new Client(base)
    assert.equal((await client.post('/auth/login', { email: 'jwt@example.com', password: 'password1' })).status, 200)
    const old = client.cookies.get(COOKIE)
    assert.equal((await me(old)).status, 200)
    assert.equal((await client.post('/auth/logout')).status, 204)
    assert.equal((await me(old)).status, 401)
  })

  test('S6: the token from before a password change is rejected afterwards', async () => {
    const client = new Client(base)
    assert.equal((await client.post('/auth/login', { email: 'jwt@example.com', password: 'password1' })).status, 200)
    const old = client.cookies.get(COOKIE)
    const changed = await client.post('/users/me/password', { currentPassword: 'password1', password: 'password2x', confirmPassword: 'password2x' })
    assert.equal(changed.status, 204)
    assert.equal((await me(old)).status, 401)
    assert.equal((await me(client.cookies.get(COOKIE))).status, 200, 'the new cookie works')
  })
})

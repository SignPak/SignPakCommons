import { afterEach, describe, expect, it, vi } from 'vitest'
import { consentTokenStore } from '../../src/utils/consentTokenStore'

/** B4: the sign-up consent token is kept in sessionStorage so a reload doesn't lose it. */

const b64url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const tokenExpiringAt = (ms) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', purpose: 'signup-consent', exp: Math.floor(ms / 1000) })}.signature`

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('consent token store', () => {
  it('B4: a saved token is read back until it expires', () => {
    const token = tokenExpiringAt(Date.now() + 30 * 60_000)
    consentTokenStore.save(token)
    expect(consentTokenStore.read()).toBe(token)
    expect(consentTokenStore.read(Date.now() + 31 * 60_000)).toBeNull()
    expect(sessionStorage.length).toBe(0, 'an expired token is removed')
  })

  it('B4: clear removes it', () => {
    consentTokenStore.save(tokenExpiringAt(Date.now() + 60_000))
    consentTokenStore.clear()
    expect(consentTokenStore.read()).toBeNull()
  })

  it('B4: a token without a readable expiry is never stored', () => {
    consentTokenStore.save('not-a-jwt')
    expect(sessionStorage.length).toBe(0)
    expect(consentTokenStore.read()).toBeNull()
  })

  it('B4: blocked or corrupt storage falls back to "no token" instead of throwing', () => {
    sessionStorage.setItem('signpak:consent-token', '{not json')
    expect(consentTokenStore.read()).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('SecurityError') })
    expect(() => consentTokenStore.save(tokenExpiringAt(Date.now() + 60_000))).not.toThrow()
    expect(consentTokenStore.read()).toBeNull()
    expect(() => consentTokenStore.clear()).not.toThrow()
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthProvider from '../../src/context/AuthProvider'
import Consent from '../../src/pages/Consent'
import { consentTokenStore } from '../../src/utils/consentTokenStore'
import { server, setupMockApi } from '../support/mswServer'

/**
 * B4: reloading the consent page used to drop the visitor back to the verify page, because the
 * token lived only in the navigation state. A reload is a fresh render with no state, which is
 * what these tests do; the token comes back from sessionStorage.
 */

setupMockApi()

beforeAll(() => {
  // jsdom has <dialog> but not its modal methods.
  HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true }
  HTMLDialogElement.prototype.close ||= function close() { this.open = false }
})

const b64url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${b64url({ alg: 'HS256' })}.${b64url({ sub: 'u1', purpose: 'signup-consent', exp: Math.floor(Date.now() / 1000) + 1800 })}.sig`

const renderAfterReload = () => render(
  <MemoryRouter initialEntries={['/signup/consent']}>
    <AuthProvider>
      <Routes>
        <Route path="/signup/consent" element={<Consent mode="signup" />} />
        <Route path="/verify-email" element={<p>verify page</p>} />
        <Route path="/home" element={<p>library page</p>} />
      </Routes>
    </AuthProvider>
  </MemoryRouter>,
)

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('consent page after a reload', () => {
  it('B4: keeps the visitor on the consent page, and accepting uses the saved token then clears it', async () => {
    const seen = []
    server.use(http.post('*/api/v1/auth/consent', async ({ request }) => {
      seen.push(await request.json())
      return HttpResponse.json({ data: { id: 'u1', email: 'sara@example.com', firstName: 'Sara', surname: 'Ahmed', role: 'user', status: 'active' } })
    }))
    consentTokenStore.save(TOKEN)
    renderAfterReload()

    expect(screen.queryByText('verify page')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and create my account' }))

    expect(await screen.findByText('library page')).toBeTruthy()
    expect(seen[0].consentToken).toBe(TOKEN)
    expect(consentTokenStore.read()).toBeNull()
  })

  it('B4: declining also clears the saved token', async () => {
    server.use(http.post('*/api/v1/auth/decline-consent', () => new HttpResponse(null, { status: 204 })))
    consentTokenStore.save(TOKEN)
    render(
      <MemoryRouter initialEntries={['/signup/consent']}>
        <AuthProvider>
          <Routes>
            <Route path="/signup/consent" element={<Consent mode="signup" />} />
            <Route path="/signup" element={<p>sign-up page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Decline and cancel sign-up' }))
    expect(await screen.findByText('sign-up page')).toBeTruthy()
    expect(consentTokenStore.read()).toBeNull()
  })

  it('B3: an expired sign-up step clears the saved token and offers a fresh sign-up', async () => {
    const message = 'This sign-up step has expired. Verify your email again to continue.'
    server.use(http.post('*/api/v1/auth/consent', () => HttpResponse.json({ error: { code: 'BAD_REQUEST', message } }, { status: 400 })))
    consentTokenStore.save(TOKEN)
    renderAfterReload()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept and create my account' }))

    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Sign up again' }).getAttribute('href')).toBe('/signup')
    expect(consentTokenStore.read()).toBeNull()
  })

  it('B3: declining with an expired step also clears the saved token', async () => {
    const message = 'This sign-up step has expired. Verify your email again to continue.'
    server.use(http.post('*/api/v1/auth/decline-consent', () => HttpResponse.json({ error: { code: 'BAD_REQUEST', message } }, { status: 400 })))
    consentTokenStore.save(TOKEN)
    renderAfterReload()

    fireEvent.click(screen.getByRole('button', { name: 'Decline and cancel sign-up' }))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(consentTokenStore.read()).toBeNull()
  })

  it('B4: with no saved token the visitor is sent back to verify their email', () => {
    renderAfterReload()
    expect(screen.getByText('verify page')).toBeTruthy()
  })
})

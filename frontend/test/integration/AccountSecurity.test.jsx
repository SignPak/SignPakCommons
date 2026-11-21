import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AccountSecurity from '../../src/components/AccountSecurity'
import { AuthContext } from '../../src/context/AuthContext'
import AuthProvider from '../../src/context/AuthProvider'
import { server, setupMockApi } from '../support/mswServer'

/**
 * Profile → Security with the real API client and only the network mocked: the password change
 * form and "Log out of all devices" (S6).
 */

setupMockApi()

const renderPanel = (auth) => render(
  <MemoryRouter initialEntries={['/profile']}>
    {auth
      ? <AuthContext.Provider value={auth}><Routes><Route path="/profile" element={<AccountSecurity />} /><Route path="/" element={<p>home page</p>} /></Routes></AuthContext.Provider>
      : <AuthProvider><Routes><Route path="/profile" element={<AccountSecurity />} /><Route path="/" element={<p>home page</p>} /></Routes></AuthProvider>}
  </MemoryRouter>,
)

const fill = ({ current = 'password1', next = 'newpassword1', confirm = next } = {}) => {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

afterEach(cleanup)

describe('password change form', () => {
  it('S6: sends the three fields and confirms that other devices were signed out', async () => {
    const seen = []
    server.use(http.post('*/api/v1/users/me/password', async ({ request }) => {
      seen.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }))
    renderPanel()
    fill()
    expect(await screen.findByText('Your password is changed. Every other device has been signed out.')).toBeTruthy()
    expect(seen).toEqual([{ currentPassword: 'password1', password: 'newpassword1', confirmPassword: 'newpassword1' }])
    expect(screen.getByLabelText('Current password').value).toBe('', 'the form is cleared')
  })

  it('a wrong current password is shown next to that field', async () => {
    server.use(http.post('*/api/v1/users/me/password', () => HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Your current password is not correct.' } }, { status: 401 },
    )))
    renderPanel()
    fill({ current: 'not-it' })
    expect(await screen.findByText('Your current password is not correct.')).toBeTruthy()
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true')
  })

  it('a server field error (same password) is shown next to the new password', async () => {
    server.use(http.post('*/api/v1/users/me/password', () => HttpResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Some fields need attention.', fields: { password: 'Choose a password different from your current one.' } } }, { status: 422 },
    )))
    renderPanel()
    fill({ next: 'password1' })
    expect(await screen.findByText('Choose a password different from your current one.')).toBeTruthy()
  })

  it('mismatched or short passwords never reach the network', async () => {
    renderPanel() // any request would fail the test (onUnhandledRequest: 'error')
    fill({ confirm: 'something-else' })
    expect(await screen.findByText('Passwords do not match.')).toBeTruthy()
    fill({ next: 'short', confirm: 'short' })
    expect(await screen.findByText('Use at least 8 characters.')).toBeTruthy()
  })
})

describe('log out of all devices', () => {
  it('S6: calls logout and leaves the profile', async () => {
    let calls = 0
    server.use(
      http.post('*/api/v1/auth/logout', () => { calls += 1; return new HttpResponse(null, { status: 204 }) }),
    )
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Log out of all devices' }))
    expect(await screen.findByText('home page')).toBeTruthy()
    await waitFor(() => expect(calls).toBe(1))
  })

  it('S6: explains that it ends every session, this one included', () => {
    renderPanel({ logout: async () => {} })
    expect(screen.getByText(/ends your session on every device where you are signed in, including this one/)).toBeTruthy()
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import VerifyEmail from '../../src/pages/VerifyEmail'
import { consentTokenStore } from '../../src/utils/consentTokenStore'

/** B3 and B4 on the verify page: the sign-up password goes with the code, and the token is kept. */

const { verifyEmail } = vi.hoisted(() => ({ verifyEmail: vi.fn() }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ verifyEmail }) }))

const b64url = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${b64url({ alg: 'HS256' })}.${b64url({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 1800 })}.sig`

const renderPage = () => render(
  <MemoryRouter initialEntries={['/verify-email?email=sara%40example.com']}>
    <Routes>
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/signup/consent" element={<p>consent page</p>} />
    </Routes>
  </MemoryRouter>,
)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('verify email page', () => {
  it('B3: sends the sign-up password with the code', async () => {
    verifyEmail.mockResolvedValue({ consentToken: TOKEN })
    renderPage()
    fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith('sara@example.com', '123456', 'password1'))
    expect(await screen.findByText('consent page')).toBeTruthy()
  })

  it('B3: the password is required before anything is sent', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByText('Enter the password you chose when signing up.')).toBeTruthy()
    expect(verifyEmail).not.toHaveBeenCalled()
  })

  it('B4: the consent token is saved, so the consent page survives a reload', async () => {
    verifyEmail.mockResolvedValue({ consentToken: TOKEN })
    renderPage()
    fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    await screen.findByText('consent page')
    expect(consentTokenStore.read()).toBe(TOKEN)
  })

  it('B3: a wrong sign-up password from the server is shown next to the password field', async () => {
    verifyEmail.mockRejectedValue(Object.assign(new Error('Some fields need attention.'), {
      status: 422, fields: { password: 'That is not the password you chose when signing up. Forgotten it? Sign up again with a new one.' },
    }))
    renderPage()
    fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByText(/That is not the password you chose when signing up/)).toBeTruthy()
  })
})

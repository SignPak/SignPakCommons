import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Login from '../src/pages/Login'
import Signup from '../src/pages/Signup'
import { api } from '../src/services/api'

const { login, signup } = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ login, signup }),
}))

describe('authentication form validation', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows Zod field errors on signup and does not submit invalid values', async () => {
    render(<MemoryRouter><Signup /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Enter your first name.')).toBeTruthy()
    expect(screen.getByText('Enter your surname.')).toBeTruthy()
    expect(screen.getByText('Enter a valid email address, like you@example.com.')).toBeTruthy()
    expect(signup).not.toHaveBeenCalled()
  })

  it('validates auth API payloads before sending a request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(api.auth.login('not-an-email', ''))
      .rejects.toMatchObject({
        status: 422,
        fields: {
          email: 'Enter a valid email address, like you@example.com.',
          password: 'Enter your password.',
        },
      })

    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps API validation errors back to the corresponding login field', async () => {
    login.mockRejectedValue(Object.assign(new Error('Invalid credentials.'), {
      fields: { email: 'Enter a valid email address.' },
    }))
    render(<MemoryRouter><Login /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    await waitFor(() => expect(login).toHaveBeenCalledOnce())
  })
})

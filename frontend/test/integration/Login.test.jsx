import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AuthProvider from '../../src/context/AuthProvider'
import { useAuth } from '../../src/context/AuthContext'
import Login from '../../src/pages/Login'
import { server, setupMockApi } from '../support/mswServer'

/**
 * Page-level integration test: the real Login page, the real AuthProvider and the real API
 * client, with only the network mocked. It proves the Phase 0 MSW setup works end to end —
 * form -> Zod -> api.auth.login -> provider state (or the error path).
 */

setupMockApi()

const SESSION = {
  id: 'user-1',
  email: 'sara@example.com',
  firstName: 'Sara',
  surname: 'Ahmed',
  role: 'user',
  status: 'active',
}

/** Shows what the provider decided, so a successful login is observable. */
function SessionProbe() {
  const { user } = useAuth()
  return <p data-testid="session">{user ? `signed in as ${user.email}` : 'signed out'}</p>
}

const renderLogin = () => render(
  <MemoryRouter>
    <AuthProvider>
      <Login />
      <SessionProbe />
    </AuthProvider>
  </MemoryRouter>,
)

// Exact labels: a /password/i match would also hit the "Forgot password?" link.
const fillAndSubmit = ({ email = 'sara@example.com', password = 'password1' } = {}) => {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /log in/i }))
}

const session = () => screen.getByTestId('session').textContent

afterEach(cleanup)

describe('login page against a mocked API', () => {
  it('signs the contributor in and puts the session in the auth provider', async () => {
    const seen = []
    server.use(http.post('*/api/v1/auth/login', async ({ request }) => {
      seen.push(await request.json())
      return HttpResponse.json({ data: SESSION })
    }))

    renderLogin()
    expect(session()).toBe('signed out')
    fillAndSubmit()

    await waitFor(() => expect(session()).toBe('signed in as sara@example.com'))
    expect(seen).toEqual([{ email: 'sara@example.com', password: 'password1' }])
  })

  it('shows the server message when the credentials are refused', async () => {
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' } },
      { status: 401 },
    )))

    renderLogin()
    fillAndSubmit({ password: 'wrong-password' })

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy()
    expect(session()).toBe('signed out')
  })

  it('puts field errors from a 422 next to their input', async () => {
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields need attention.',
          fields: { email: 'Enter a valid email address.' },
        },
      },
      { status: 422 },
    )))

    renderLogin()
    fillAndSubmit({ email: 'sara@example.co' })

    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    // A field error is not also shown as a form-level alert.
    expect(screen.queryByText('Some fields need attention.')).toBeNull()
  })

  it('never reaches the network when the form itself is invalid', async () => {
    let calls = 0
    server.use(http.post('*/api/v1/auth/login', () => { calls += 1; return HttpResponse.json({ data: SESSION }) }))

    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/enter your password/i)).toBeTruthy()
    expect(calls).toBe(0)
  })
})

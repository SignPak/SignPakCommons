import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../src/context/AuthContext'
import ContactForm from '../../src/components/ContactForm'
import AuthProvider from '../../src/context/AuthProvider'
import Landing from '../../src/pages/Landing'
import { server, setupMockApi } from '../support/mswServer'

/**
 * C2: the real contact form and the real API client, with only the network mocked. Before
 * Phase 4 the form never called the API at all.
 */

setupMockApi()

const USER = { id: 'user-1', firstName: 'Sara', surname: 'Ahmed', email: 'sara@example.com' }

function Where() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>
}

const renderForm = (user = null) => render(
  <MemoryRouter initialEntries={['/']}>
    <AuthContext.Provider value={{ user, sessionChecked: true }}>
      <Routes>
        <Route path="/" element={<ContactForm />} />
        <Route path="/contact/verify" element={<p>verify page</p>} />
      </Routes>
      <Where />
    </AuthContext.Provider>
  </MemoryRouter>,
)

const fill = ({ name, email, message }) => {
  if (name !== undefined) fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } })
  if (email !== undefined) fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } })
  if (message !== undefined) fireEvent.change(screen.getByLabelText('Your message'), { target: { value: message } })
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: /send/i }))

const captureContact = (response) => {
  const seen = []
  server.use(http.post('*/api/v1/contact', async ({ request }) => {
    seen.push(await request.json())
    return response()
  }))
  return seen
}

afterEach(cleanup)

describe('contact form on the landing page', () => {
  it('C2: a signed-in contributor who opens the landing page directly gets the signed-in form', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: { ...USER, role: 'user', status: 'active' } })),
      http.get('*/api/v1/public/stats', () => HttpResponse.json({ data: {} })),
    )
    render(<MemoryRouter><AuthProvider><Landing /></AuthProvider></MemoryRouter>)

    await waitFor(() => expect(screen.getByLabelText('Contact topic').value).toBe('general'))
    expect(screen.getByLabelText('Email address').value).toBe('sara@example.com')
    expect(screen.getByRole('button', { name: /send message/i }).disabled).toBe(false)
  })
})

describe('contact form against a mocked API', () => {
  it('C2: a signed-in contributor sends a general message and sees the confirmation', async () => {
    const seen = captureContact(() => HttpResponse.json({ data: { received: true, id: 'a'.repeat(24), verificationRequired: false } }, { status: 201 }))
    renderForm(USER)
    fill({ message: 'Hello from the form' })
    submit()

    expect(await screen.findByText('Message received.')).toBeTruthy()
    expect(seen).toEqual([{ topic: 'general', name: 'Sara Ahmed', email: 'sara@example.com', message: 'Hello from the form' }])
  })

  it('C2: a signed-out deletion request goes to the verify page with the message id', async () => {
    const id = 'b'.repeat(24)
    const seen = captureContact(() => HttpResponse.json({ data: { received: true, id, verificationRequired: true } }, { status: 201 }))
    renderForm()
    fill({ name: 'Former contributor', email: 'former@example.com', message: 'Please delete my data' })
    submit()

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/contact/verify?id=${id}`))
    expect(seen[0].topic).toBe('recording-deletion')
    expect(seen[0].email).toBe('former@example.com')
  })

  it('C2: a signed-in deletion request needs no code and shows the confirmation', async () => {
    const seen = captureContact(() => HttpResponse.json({ data: { received: true, id: 'c'.repeat(24), verificationRequired: false } }, { status: 201 }))
    renderForm(USER)
    fireEvent.change(screen.getByLabelText('Contact topic'), { target: { value: 'recording-deletion' } })
    fill({ message: 'Delete everything' })
    submit()

    expect(await screen.findByText('Message received.')).toBeTruthy()
    expect(seen[0].topic).toBe('recording-deletion')
  })

  it('C2: field errors from a 422 appear next to their input', async () => {
    captureContact(() => HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Some fields need attention.', fields: { email: 'Enter a valid email address, like you@example.com.' } } }, { status: 422 }))
    renderForm()
    fill({ name: 'Visitor', email: 'not-an-email', message: 'Hi' })
    submit()

    expect(await screen.findByText('Enter a valid email address, like you@example.com.')).toBeTruthy()
    expect(screen.queryByText('Some fields need attention.')).toBeNull()
  })

  it.each([
    [403, 'Use the email address on your account to contact us.'],
    [409, 'You can send one contact message per day.'],
    [429, 'The contact form has reached its daily message limit. Try again tomorrow.'],
  ])('C2: a %s from the server shows its message and keeps the form', async (status, message) => {
    captureContact(() => HttpResponse.json({ error: { code: 'REFUSED', message } }, { status }))
    renderForm(USER)
    fill({ message: 'Hello' })
    submit()

    expect(await screen.findByText(message)).toBeTruthy()
    expect(screen.getByLabelText('Your message').value).toBe('Hello')
    expect(screen.getByRole('button', { name: /send message/i }).disabled).toBe(false)
  })
})

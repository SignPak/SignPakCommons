import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../src/context/AuthContext'
import ContactForm from '../../src/components/ContactForm'

/** C2: what the contact form offers to a signed-out visitor and to a signed-in contributor. */

const USER = { id: 'user-1', firstName: 'Sara', surname: 'Ahmed', email: 'sara@example.com' }

const renderForm = (user = null, { sessionChecked = true } = {}) => render(
  <MemoryRouter>
    <AuthContext.Provider value={{ user, sessionChecked }}>
      <ContactForm />
    </AuthContext.Provider>
  </MemoryRouter>,
)

const topicOptions = () => [...screen.getByLabelText('Contact topic').querySelectorAll('option')].map((option) => option.textContent)

afterEach(cleanup)

describe('contact form topics', () => {
  it('C2: a signed-out visitor is offered only the deletion request, with its explanation', () => {
    renderForm()
    expect(topicOptions()).toEqual(['Request recording/data deletion'])
    expect(screen.getByLabelText('Contact topic').value).toBe('recording-deletion')
    expect(screen.getByTestId('deletion-explainer').textContent).toMatch(/six-digit code/)
    expect(screen.getByText('Log in to send a general or partnership message.')).toBeTruthy()
    expect(screen.getByLabelText('Email address').readOnly).toBe(false)
    expect(screen.getByRole('button', { name: /send deletion request/i })).toBeTruthy()
  })

  it('C2: a signed-in contributor sees all three topics, general first, with name and email filled in', () => {
    renderForm(USER)
    expect(topicOptions()).toEqual(['General inquiry', 'Partnership', 'Request recording/data deletion'])
    expect(screen.getByLabelText('Contact topic').value).toBe('general')
    expect(screen.queryByTestId('deletion-explainer')).toBeNull()
    expect(screen.getByLabelText('Your name').value).toBe('Sara Ahmed')
    expect(screen.getByLabelText('Email address').value).toBe('sara@example.com')
    expect(screen.getByLabelText('Email address').readOnly).toBe(true)
  })

  it('C2: sending waits until the session check has finished', () => {
    renderForm(null, { sessionChecked: false })
    const button = screen.getByRole('button', { name: /checking your session/i })
    expect(button.disabled).toBe(true)
  })

  it('C2: choosing the deletion topic when signed in explains it is confirmed straight away', () => {
    renderForm(USER)
    fireEvent.change(screen.getByLabelText('Contact topic'), { target: { value: 'recording-deletion' } })
    const explainer = screen.getByTestId('deletion-explainer').textContent
    expect(explainer).toMatch(/confirmed straight away/)
    expect(explainer).not.toMatch(/six-digit code/)
  })
})

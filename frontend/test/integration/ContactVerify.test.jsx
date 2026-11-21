import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ContactVerify, { RESEND_WAIT_SECONDS } from '../../src/pages/ContactVerify'
import { server, setupMockApi } from '../support/mswServer'

/** D4: the page that confirms a signed-out deletion request with the emailed code. */

setupMockApi()

const ID = 'd'.repeat(24)
const renderPage = (search = `?id=${ID}`) => render(
  <MemoryRouter initialEntries={[`/contact/verify${search}`]}>
    <ContactVerify />
  </MemoryRouter>,
)
const enterCode = (code) => fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: code } })
const confirm = () => fireEvent.click(screen.getByRole('button', { name: /confirm request/i }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('deletion-request verify page against a mocked API', () => {
  it('D4: the right code confirms the request', async () => {
    const seen = []
    server.use(http.post(`*/api/v1/contact/${ID}/verify`, async ({ request }) => {
      seen.push(await request.json())
      return HttpResponse.json({ data: { verified: true } })
    }))
    renderPage()
    enterCode('12-34 56')
    confirm()

    expect(await screen.findByText('Request verified.')).toBeTruthy()
    expect(seen).toEqual([{ code: '123456' }])
  })

  it('D4: a wrong or expired code shows the server message', async () => {
    server.use(http.post(`*/api/v1/contact/${ID}/verify`, () => HttpResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'That code is invalid or has expired. Request a new code and try again.' } },
      { status: 400 },
    )))
    renderPage()
    enterCode('000000')
    confirm()

    expect(await screen.findByText('That code is invalid or has expired. Request a new code and try again.')).toBeTruthy()
    expect(screen.queryByText('Request verified.')).toBeNull()
  })

  it('D4: a code that is not six digits never reaches the network', async () => {
    renderPage()
    enterCode('123')
    confirm()
    expect(await screen.findByText('Enter the six-digit code from your email.')).toBeTruthy()
  })

  it('D4: the resend button waits a minute, then asks for a new code and waits again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let resends = 0
    server.use(http.post(`*/api/v1/contact/${ID}/resend`, () => {
      resends += 1
      return HttpResponse.json({ data: { message: 'If an account uses this email, a new code is on its way.' } }, { status: 202 })
    }))
    renderPage()
    const button = () => screen.getByRole('button', { name: /send a new code/i })
    expect(button().disabled).toBe(true)
    expect(button().textContent).toBe(`Send a new code in ${RESEND_WAIT_SECONDS}s`)

    for (let second = 0; second < RESEND_WAIT_SECONDS; second += 1) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }
    expect(button().disabled).toBe(false)
    fireEvent.click(button())

    expect(await screen.findByText('If an account uses this email, a new code is on its way.')).toBeTruthy()
    expect(resends).toBe(1)
    expect(button().disabled).toBe(true)
  })

  it('D4: a 429 on resend shows the server message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    server.use(http.post(`*/api/v1/contact/${ID}/resend`, () => HttpResponse.json(
      { error: { code: 'TOO_MANY_REQUESTS', message: 'Wait a minute before asking for a new code.' } },
      { status: 429 },
    )))
    renderPage()
    for (let second = 0; second < RESEND_WAIT_SECONDS; second += 1) {
      await act(async () => { vi.advanceTimersByTime(1000) })
    }
    fireEvent.click(screen.getByRole('button', { name: /send a new code/i }))
    expect(await screen.findByText('Wait a minute before asking for a new code.')).toBeTruthy()
  })

  it.each([[''], ['?id='], ['?id=../../admin'], ['?id=%3Cscript%3E']])('D4: a missing or malformed id (%s) shows an invalid-link message', (search) => {
    renderPage(search)
    expect(screen.getByText('This link is not valid.')).toBeTruthy()
    expect(screen.queryByLabelText('Six-digit code')).toBeNull()
  })
})

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminMessages from '../../src/pages/admin/AdminMessages'
import { server, setupMockApi } from '../support/mswServer'

/**
 * C3: Admin → Messages with the real API client and only the network mocked: listing and
 * filtering the inbox, and acting on a deletion request from "Find contributor" to "Mark done".
 */

setupMockApi()

const REQUEST_ID = 'a'.repeat(24)
const GENERAL_ID = 'b'.repeat(24)
const USER_ID = 'c'.repeat(24)
const DELETED_ID = 'd'.repeat(24)

const message = (fields) => ({
  topic: 'recording-deletion', name: 'Sara Ahmed', email: 'sara@example.com', message: 'Please delete my recordings.',
  verified: false, status: 'open', handledAt: null, handledBy: null, userId: null, createdAt: '2026-11-20T10:00:00.000Z', ...fields,
})

let seenQueries, confirm

beforeEach(() => {
  seenQueries = []
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  server.use(http.get('*/api/v1/admin/messages', ({ request }) => {
    const url = new URL(request.url)
    seenQueries.push(Object.fromEntries(url.searchParams))
    const all = [
      message({ id: REQUEST_ID }),
      message({ id: GENERAL_ID, topic: 'general', name: 'Omar Khan', email: 'omar@example.com', message: 'Hello', verified: false }),
    ]
    const topic = url.searchParams.get('topic')
    return HttpResponse.json({ data: topic ? all.filter((m) => m.topic === topic) : all })
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const row = (id) => screen.getByTestId(`message-${id}`)

describe('Admin → Messages against a mocked API', () => {
  it('C3: lists messages with their verification badge, open messages first by default', async () => {
    render(<MemoryRouter><AdminMessages /></MemoryRouter>)
    await screen.findByTestId(`message-${REQUEST_ID}`)
    expect(seenQueries[0]).toEqual({ limit: '100', status: 'open' })
    expect(within(row(REQUEST_ID)).getByText('Unverified')).toBeTruthy()
    expect(within(row(REQUEST_ID)).getByText('Please delete my recordings.')).toBeTruthy()
    expect(within(row(GENERAL_ID)).queryByText('Unverified')).toBeNull()
    expect(within(row(GENERAL_ID)).queryByRole('button', { name: 'Find contributor' })).toBeNull()
  })

  it('C3: the filters reach the API', async () => {
    render(<MemoryRouter><AdminMessages /></MemoryRouter>)
    await screen.findByTestId(`message-${REQUEST_ID}`)
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'recording-deletion' } })
    await waitFor(() => expect(seenQueries.at(-1)).toEqual({ limit: '100', status: 'open', topic: 'recording-deletion' }))
    fireEvent.change(screen.getByLabelText('Verified'), { target: { value: 'false' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } })
    await waitFor(() => expect(seenQueries.at(-1)).toEqual({ limit: '100', topic: 'recording-deletion', verified: 'false' }))
    await waitFor(() => expect(screen.queryByTestId(`message-${GENERAL_ID}`)).toBeNull())
  })

  it('C3: find contributor → delete recordings with the confirmed count → mark done', async () => {
    const calls = []
    server.use(
      http.get('*/api/v1/admin/deletion-lookup', ({ request }) => {
        calls.push(['lookup', new URL(request.url).search])
        return HttpResponse.json({ data: { matches: [
          { kind: 'user', userId: USER_ID, name: 'Sara Ahmed', email: 'sara@example.com', submissionCount: 2 },
          { kind: 'deleted', userId: DELETED_ID, deletedAt: '2026-10-01T00:00:00.000Z', deletedBy: 'self', submissionCount: 0 },
        ] } })
      }),
      http.delete(`*/api/v1/admin/users/${USER_ID}/submissions`, ({ request }) => {
        calls.push(['delete', new URL(request.url).search])
        return HttpResponse.json({ data: { deleted: 2, failed: [] } })
      }),
      http.patch(`*/api/v1/admin/messages/${REQUEST_ID}`, async ({ request }) => {
        const body = await request.json()
        calls.push(['status', body.status])
        return HttpResponse.json({ data: message({ id: REQUEST_ID, status: body.status, handledAt: '2026-11-21T00:00:00.000Z', handledBy: 'admin-1' }) })
      }),
    )
    render(<MemoryRouter><AdminMessages /></MemoryRouter>)
    fireEvent.click(await within(await screen.findByTestId(`message-${REQUEST_ID}`)).findByRole('button', { name: 'Find contributor' }))

    const lookup = await screen.findByTestId(`lookup-${REQUEST_ID}`)
    expect(calls[0]).toEqual(['lookup', `?messageId=${REQUEST_ID}`])
    expect(within(lookup).getByText(/Sara Ahmed \(current account\): 2 recordings/)).toBeTruthy()
    expect(within(lookup).getByText(/Deleted account .* by its owner\): 0 recordings/)).toBeTruthy()

    const [deleteCurrent, deleteOld] = within(lookup).getAllByRole('button', { name: 'Delete recordings' })
    expect(deleteOld.disabled).toBe(true, 'nothing to delete')
    fireEvent.click(deleteCurrent)
    await waitFor(() => expect(calls[1]).toEqual(['delete', `?requestMessageId=${REQUEST_ID}`]))
    expect(confirm.mock.calls[0][0]).toMatch(/^Delete 2 recordings for Sara Ahmed \(current account\)\?/)
    expect(await screen.findByText(/Deleted 2 recordings\./)).toBeTruthy()
    expect(within(lookup).getByText(/Sara Ahmed \(current account\): 0 recordings/)).toBeTruthy()

    fireEvent.click(within(row(REQUEST_ID)).getByRole('button', { name: 'Mark done' }))
    await waitFor(() => expect(within(row(REQUEST_ID)).getByText('Done')).toBeTruthy())
    expect(calls[2]).toEqual(['status', 'done'])
    expect(within(row(REQUEST_ID)).getByRole('button', { name: 'Reopen' })).toBeTruthy()
  })

  it('C3: an unverified request with no current account is flagged for a manual check', async () => {
    server.use(http.get('*/api/v1/admin/deletion-lookup', () => HttpResponse.json({ data: { matches: [] } })))
    render(<MemoryRouter><AdminMessages /></MemoryRouter>)
    fireEvent.click(await within(await screen.findByTestId(`message-${REQUEST_ID}`)).findByRole('button', { name: 'Find contributor' }))
    expect(await within(row(REQUEST_ID)).findByText('Manual check')).toBeTruthy()
    expect(screen.getByText(/Check the request by hand before deleting anything/)).toBeTruthy()
  })

  it('C3: a partial failure is shown and the remaining count is kept', async () => {
    server.use(
      http.get('*/api/v1/admin/deletion-lookup', () => HttpResponse.json({ data: { matches: [{ kind: 'user', userId: USER_ID, name: 'Sara Ahmed', email: 'sara@example.com', submissionCount: 3 }] } })),
      http.delete(`*/api/v1/admin/users/${USER_ID}/submissions`, () => HttpResponse.json({ data: { deleted: 2, failed: [{ id: 'x', reason: 'r' }] } })),
    )
    render(<MemoryRouter><AdminMessages /></MemoryRouter>)
    fireEvent.click(await within(await screen.findByTestId(`message-${REQUEST_ID}`)).findByRole('button', { name: 'Find contributor' }))
    fireEvent.click(await within(await screen.findByTestId(`lookup-${REQUEST_ID}`)).findByRole('button', { name: 'Delete recordings' }))
    expect(await screen.findByText('Deleted 2, but 1 could not be deleted from storage. Try again.')).toBeTruthy()
    expect(within(screen.getByTestId(`lookup-${REQUEST_ID}`)).getByText(/1 recording$/)).toBeTruthy()
  })
})

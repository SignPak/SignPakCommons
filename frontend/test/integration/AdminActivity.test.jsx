import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminActivity from '../../src/pages/admin/AdminActivity'
import { server, setupMockApi } from '../support/mswServer'

/**
 * S7: Admin → Activity with the real API client and only the network mocked: entries with the
 * admin's name and a readable action, the admin and action filters, and paging.
 */

setupMockApi()

const NIDA = 'a'.repeat(24)
const OMAR = 'b'.repeat(24)

const entry = (n, fields) => ({
  id: String(n).padStart(24, '0'), actor: { id: NIDA, name: 'Nida Admin' }, action: 'category.create', targetType: 'category',
  targetId: 'c'.repeat(24), meta: { label: `Category ${n}` }, at: '2026-11-21T10:00:00.000Z', ...fields,
})

let seenQueries, total

beforeEach(() => {
  seenQueries = []
  total = 2
  server.use(
    // B7 (Phase 8): the page asks for one page of admins (?role=admin&limit=), as the API answers it.
    http.get('*/api/v1/admin/users', ({ request }) => {
      const role = new URL(request.url).searchParams.get('role')
      const everyone = [
        { id: NIDA, firstName: 'Nida', surname: 'Admin', role: 'admin', email: 'nida@example.com', status: 'active' },
        { id: OMAR, firstName: 'Omar', surname: 'Admin', role: 'admin', email: 'omar@example.com', status: 'active' },
        { id: 'd'.repeat(24), firstName: 'Sara', surname: 'Ahmed', role: 'user', email: 'sara@example.com', status: 'active' },
      ]
      const items = role ? everyone.filter((user) => user.role === role) : everyone
      return HttpResponse.json({ data: { items, nextCursor: null, total: items.length } })
    }),
    http.get('*/api/v1/admin/audit', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      seenQueries.push(query)
      const page = Number(query.page)
      const entries = page === 1
        ? [entry(1), entry(2, { actor: { id: null, name: 'System' }, action: 'admin.promote', targetType: 'user', meta: {} })]
        : [entry(3, { actor: { id: OMAR, name: 'Omar Admin' }, action: 'recordings.delete', targetType: 'user', meta: { deleted: 3, failed: 0 } })]
      return HttpResponse.json({ data: { entries, page, limit: Number(query.limit), total } })
    }),
  )
})

afterEach(() => cleanup())

const renderPage = () => render(<MemoryRouter><AdminActivity /></MemoryRouter>)

describe('Admin → Activity against a mocked API', () => {
  it('S7: lists entries with the admin name, a readable action, the target and the details', async () => {
    renderPage()
    const first = await screen.findByTestId(`activity-${entry(1).id}`)
    expect(seenQueries[0]).toEqual({ page: '1', limit: '25' })
    expect(within(first).getByText('Nida Admin')).toBeTruthy()
    expect(within(first).getByText('Added a category')).toBeTruthy()
    expect(within(first).getByText('Name: Category 1')).toBeTruthy()
    expect(within(first).getByText(/Category …c{6}/)).toBeTruthy()
    const second = screen.getByTestId(`activity-${entry(2).id}`)
    expect(within(second).getByText('System')).toBeTruthy()
    expect(within(second).getByText('Made an admin')).toBeTruthy()
    expect(screen.getByText('2 entries')).toBeTruthy()
  })

  it('S7: the admin filter offers the admins and System, and sends the chosen one', async () => {
    renderPage()
    await screen.findByTestId(`activity-${entry(1).id}`)
    const select = screen.getByLabelText('Admin')
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Omar Admin' })).toBeTruthy())
    expect(within(select).queryByRole('option', { name: 'Sara Ahmed' })).toBeNull()
    fireEvent.change(select, { target: { value: OMAR } })
    await waitFor(() => expect(seenQueries.at(-1)).toEqual({ page: '1', limit: '25', actor: OMAR }))
    fireEvent.change(select, { target: { value: 'system' } })
    await waitFor(() => expect(seenQueries.at(-1)).toEqual({ page: '1', limit: '25', actor: 'system' }))
  })

  it('S7: the action filter sends the chosen action and goes back to page 1', async () => {
    total = 30
    renderPage()
    await screen.findByTestId(`activity-${entry(1).id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(seenQueries.at(-1).page).toBe('2'))
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'recordings.delete' } })
    await waitFor(() => expect(seenQueries.at(-1)).toEqual({ page: '1', limit: '25', action: 'recordings.delete' }))
  })

  it('S7: Previous and Next page through the log', async () => {
    total = 30
    renderPage()
    await screen.findByTestId(`activity-${entry(1).id}`)
    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const third = await screen.findByTestId(`activity-${entry(3).id}`)
    expect(within(third).getByText('Omar Admin')).toBeTruthy()
    expect(within(third).getByText('Deleted: 3 · Failed: 0')).toBeTruthy()
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await screen.findByTestId(`activity-${entry(1).id}`)
  })

  it('S7: an empty log and a failed request each show a message', async () => {
    server.use(http.get('*/api/v1/admin/audit', () => HttpResponse.json({ data: { entries: [], page: 1, limit: 25, total: 0 } })))
    renderPage()
    expect(await screen.findByText('No activity matches these filters.')).toBeTruthy()
    cleanup()
    server.use(http.get('*/api/v1/admin/audit', () => HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Admins only.' } }, { status: 403 })))
    renderPage()
    expect(await screen.findByText('Admins only.')).toBeTruthy()
  })
})

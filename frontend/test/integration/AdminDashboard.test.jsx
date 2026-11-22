import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LibraryContext } from '../../src/context/LibraryContext'
import AdminDashboard from '../../src/pages/admin/AdminDashboard'
import { server, setupMockApi } from '../support/mswServer'

/**
 * B7: the dashboard renders from GET /admin/stats alone. It never asks for the submissions list
 * or the whole user list (MSW fails the test on any request nobody mocked, and the handlers
 * below record what was asked).
 */

setupMockApi()

const FOOD = 'f'.repeat(24)
const SARA = 'a'.repeat(24)
const library = { categories: [{ id: FOOD, label: 'Food', tone: 'yellow' }], videos: [], submissions: [] }

const stats = (overrides = {}) => ({
  totals: { contributors: 9, videos: 4, publishedVideos: 3, submissions: 40, categories: 1 },
  totalsByCategory: [{ categoryId: FOOD, count: 40 }],
  activity: Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${String(16 + i).padStart(2, '0')}`, count: i })),
  byCategory: [{ categoryId: FOOD, label: 'Food', tone: 'yellow', count: 21 }],
  summary: { recordings: 21, activeContributors: 5, videosRecorded: 3, topCategory: { categoryId: FOOD, label: 'Food', count: 21 } },
  topVideos: [{ videoId: 'v'.repeat(24), title: 'Bread', categoryId: FOOD, tone: 'yellow', count: 12 }],
  topContributors: [{ userId: SARA, name: 'Sara Ahmed', count: 8 }],
  recent: [{ id: '1'.repeat(24), submittedAt: '2026-11-22T09:00:00.000Z', contributor: { id: SARA, name: 'Sara Ahmed' }, video: { id: 'v'.repeat(24), title: 'Bread' }, category: { id: FOOD, label: 'Food' } }],
  ...overrides,
})

let statsQueries, otherCalls

beforeEach(() => {
  statsQueries = []
  otherCalls = []
  server.use(
    http.get('*/api/v1/admin/stats', ({ request }) => {
      statsQueries.push(Object.fromEntries(new URL(request.url).searchParams))
      return HttpResponse.json({ data: stats() })
    }),
    http.get('*/api/v1/admin/users', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      otherCalls.push({ users: query })
      return HttpResponse.json({ data: { items: [{ id: SARA, firstName: 'Sara', surname: 'Ahmed', email: 'sara@example.com', role: 'user' }], total: 1, nextCursor: null } })
    }),
    http.get('*/api/v1/submissions', () => { otherCalls.push('submissions'); return HttpResponse.json({ data: [] }) }),
  )
})

afterEach(() => cleanup())

const renderPage = () => render(<MemoryRouter><LibraryContext.Provider value={library}><AdminDashboard /></LibraryContext.Provider></MemoryRouter>)

describe('Admin → Dashboard against a mocked API', () => {
  it('B7: renders the key numbers, chart, categories, top lists and recent list from /admin/stats only', async () => {
    renderPage()
    const numbers = await screen.findByLabelText('Key numbers')
    await waitFor(() => expect(within(numbers).getByText('21')).toBeTruthy())
    expect(within(numbers).getByText('5')).toBeTruthy()
    expect(within(numbers).getByText('3')).toBeTruthy()
    expect(within(numbers).getByText('Food')).toBeTruthy()
    expect(statsQueries).toEqual([{ days: '14' }])
    expect(screen.getByRole('img', { name: /Peak: 6/ })).toBeTruthy()
    expect(screen.getAllByText('Bread').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sara Ahmed').length).toBe(2)
    expect(otherCalls, 'no submissions list and no user list').toEqual([])
  })

  it('B7: the days, category and contributor filters reach the stats query', async () => {
    renderPage()
    await waitFor(() => expect(statsQueries.length).toBe(1))
    fireEvent.change(screen.getByLabelText('Days'), { target: { value: '30' } })
    await waitFor(() => expect(statsQueries.at(-1)).toEqual({ days: '30' }))
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: FOOD } })
    await waitFor(() => expect(statsQueries.at(-1)).toEqual({ days: '30', categoryId: FOOD }))
    fireEvent.change(screen.getByLabelText('Contributor'), { target: { value: 'sara' } })
    fireEvent.click(await screen.findByRole('button', { name: /Sara Ahmed/ }))
    await waitFor(() => expect(statsQueries.at(-1)).toEqual({ days: '30', categoryId: FOOD, userId: SARA }))
    expect(otherCalls).toEqual([{ users: { limit: '8', role: 'user', q: 'sara' } }])
  })

  it('B7: an empty range shows the empty notes, and a failed request shows an error', async () => {
    server.use(http.get('*/api/v1/admin/stats', () => HttpResponse.json({ data: stats({ summary: { recordings: 0, activeContributors: 0, videosRecorded: 0, topCategory: null }, topVideos: [], topContributors: [], recent: [] }) })))
    renderPage()
    expect(await screen.findByText('No recorded videos in this range yet.')).toBeTruthy()
    expect(screen.getByText('No contributor activity in this view.')).toBeTruthy()
    cleanup()
    server.use(http.get('*/api/v1/admin/stats', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'Stats are down.' } }, { status: 500 })))
    renderPage()
    expect(await screen.findByText(/Stats are down\./)).toBeTruthy()
  })
})

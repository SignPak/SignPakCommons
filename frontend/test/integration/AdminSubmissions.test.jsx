import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LibraryContext } from '../../src/context/LibraryContext'
import AdminSubmissions from '../../src/pages/admin/AdminSubmissions'
import { server, setupMockApi } from '../support/mswServer'

/**
 * B5: Admin → Submissions with the real API client and only the network mocked: the filters
 * reach GET /admin/submissions, "Load more" follows the cursor, and the download links carry
 * the same filters to the export.
 */

setupMockApi()

const FOOD = 'f'.repeat(24)
const GREET = 'e'.repeat(24)
const BREAD = 'b'.repeat(24)
const HELLO = 'c'.repeat(24)
const SARA = 'a'.repeat(24)
const library = {
  categories: [{ id: FOOD, label: 'Food', tone: 'yellow' }, { id: GREET, label: 'Greetings', tone: 'blue' }],
  videos: [{ id: BREAD, title: 'Bread', categoryId: FOOD }, { id: HELLO, title: 'Hello', categoryId: GREET }],
}

const row = (n, fields) => ({
  submissionId: String(n).padStart(24, '0'), userId: SARA, videoId: BREAD, videoTitle: 'Bread', categoryId: FOOD, categoryLabel: 'Food',
  driveFileId: `drive-${n}`, archivePath: null, mimeType: 'video/webm', size: 2048, duration: 3, trimStart: 0.5, trimEnd: 2, mirrored: false,
  submittedAt: '2026-11-21T10:00:00.000Z', storageDriver: 'gdrive-archive', contributorName: 'Sara Ahmed', ...fields,
})

let seen

beforeEach(() => {
  seen = []
  server.use(
    http.get('*/api/v1/admin/submissions', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      seen.push(query)
      if (query.cursor) return HttpResponse.json({ data: { items: [row(3, { mirrored: true })], total: 3, nextCursor: null } })
      return HttpResponse.json({ data: { items: [row(1), row(2, { videoTitle: 'Hello', categoryLabel: 'Greetings' })], total: 3, nextCursor: row(2).submissionId } })
    }),
    http.get('*/api/v1/admin/users', ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      seen.push({ users: query })
      return HttpResponse.json({ data: { items: [{ id: SARA, firstName: 'Sara', surname: 'Ahmed', email: 'sara@example.com', role: 'user' }], total: 1, nextCursor: null } })
    }),
  )
})

afterEach(() => cleanup())

const renderPage = () => render(<MemoryRouter><LibraryContext.Provider value={library}><AdminSubmissions /></LibraryContext.Provider></MemoryRouter>)
const link = (name) => new URL(screen.getByRole('link', { name }).getAttribute('href'), 'http://localhost')

describe('Admin → Submissions against a mocked API', () => {
  it('B5: lists submissions with trim, mirror and the contributor, and Load more follows the cursor', async () => {
    renderPage()
    const first = await screen.findByTestId(`submission-${row(1).submissionId}`)
    expect(seen[0]).toEqual({ limit: '25' })
    expect(within(first).getByText('Sara Ahmed')).toBeTruthy()
    expect(within(first).getByText('0.50 s – 2.00 s')).toBeTruthy()
    expect(screen.getByText('3 submissions')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    const third = await screen.findByTestId(`submission-${row(3).submissionId}`)
    expect(within(third).getByText('Mirrored')).toBeTruthy()
    expect(seen.at(-1)).toEqual({ limit: '25', cursor: row(2).submissionId })
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('B5: the category, video and date filters reach the API, and a new category clears the video', async () => {
    renderPage()
    await screen.findByTestId(`submission-${row(1).submissionId}`)
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: FOOD } })
    await waitFor(() => expect(seen.at(-1)).toEqual({ limit: '25', categoryId: FOOD }))
    const videos = within(screen.getByLabelText('Video')).getAllByRole('option').map((option) => option.textContent)
    expect(videos).toEqual(['All videos', 'Bread'])
    fireEvent.change(screen.getByLabelText('Video'), { target: { value: BREAD } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-30' } })
    await waitFor(() => expect(seen.at(-1)).toEqual({ limit: '25', categoryId: FOOD, videoId: BREAD, from: '2026-11-01', to: '2026-11-30' }))
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: GREET } })
    await waitFor(() => expect(seen.at(-1)).toEqual({ limit: '25', categoryId: GREET, from: '2026-11-01', to: '2026-11-30' }))
  })

  it('B5: the contributor search filters by the chosen contributor', async () => {
    renderPage()
    await screen.findByTestId(`submission-${row(1).submissionId}`)
    fireEvent.change(screen.getByLabelText('Contributor'), { target: { value: 'sar' } })
    fireEvent.click(await screen.findByRole('button', { name: /Sara Ahmed/ }))
    await waitFor(() => expect(seen.at(-1)).toEqual({ limit: '25', userId: SARA }))
    expect(seen.find((query) => query.users)).toEqual({ users: { limit: '8', role: 'user', q: 'sar' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear contributor filter' }))
    await waitFor(() => expect(seen.at(-1)).toEqual({ limit: '25' }))
  })

  it('B5: Download CSV and Download JSON link to the export with the current filters', async () => {
    renderPage()
    await screen.findByTestId(`submission-${row(1).submissionId}`)
    expect(link('Download CSV').pathname).toBe('/api/v1/admin/submissions/export')
    expect(Object.fromEntries(link('Download CSV').searchParams)).toEqual({ format: 'csv' })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: GREET } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } })
    await waitFor(() => expect(Object.fromEntries(link('Download JSON').searchParams)).toEqual({ format: 'json', categoryId: GREET, from: '2026-11-01' }))
    expect(screen.getByRole('link', { name: 'Download CSV' }).hasAttribute('download')).toBe(true)
  })

  it('B5: an end date before the start date is flagged and nothing is requested', async () => {
    renderPage()
    await screen.findByTestId(`submission-${row(1).submissionId}`)
    const before = seen.length
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-30' } })
    await waitFor(() => expect(seen.length).toBe(before + 1))
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-01' } })
    expect(await screen.findByText('The end date must be on or after the start date.')).toBeTruthy()
    expect(seen.length).toBe(before + 1)
    expect(screen.getByText('Download CSV').getAttribute('href'), 'no export link while the range is invalid').toBeNull()
  })
})

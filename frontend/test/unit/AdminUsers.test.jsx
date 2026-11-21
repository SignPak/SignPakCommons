import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsers from '../../src/pages/admin/AdminUsers'

/** C3: deleting a contributor's recordings, and their account with them, from Admin → Users. */

const { api } = vi.hoisted(() => ({
  api: {
    users: { list: vi.fn(), setStatus: vi.fn(), remove: vi.fn() },
    admin: { restrictions: vi.fn(), userSubmissions: vi.fn(), removeUserSubmissions: vi.fn() },
  },
}))

vi.mock('../../src/services/api', () => ({ api }))
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }) }))

const SARA = { id: 'user-1', firstName: 'Sara', surname: 'Ahmed', email: 'sara@example.com', role: 'user', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }

let confirm

beforeEach(() => {
  api.users.list.mockResolvedValue([SARA])
  api.admin.restrictions.mockResolvedValue([])
  api.admin.userSubmissions.mockResolvedValue({ items: [], total: 3, nextCursor: null })
  api.admin.removeUserSubmissions.mockResolvedValue({ deleted: 3, failed: [] })
  api.users.remove.mockResolvedValue(undefined)
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const click = async (name) => fireEvent.click(await screen.findByRole('button', { name }))

describe('Admin → Users deletion actions', () => {
  it('C3: "Delete recordings" confirms with the right count, then deletes them', async () => {
    render(<AdminUsers />)
    await click('Delete recordings')

    await waitFor(() => expect(api.admin.removeUserSubmissions).toHaveBeenCalledWith('user-1'))
    expect(api.admin.userSubmissions).toHaveBeenCalledWith('user-1', { limit: 1 })
    expect(confirm.mock.calls[0][0]).toMatch(/Delete Sara Ahmed's 3 recordings\?/)
    expect(await screen.findByText('Deleted 3 recordings for Sara Ahmed.')).toBeTruthy()
    expect(api.users.remove).not.toHaveBeenCalled()
  })

  it('C3: nothing is deleted when the admin cancels the confirmation', async () => {
    confirm.mockReturnValue(false)
    render(<AdminUsers />)
    await click('Delete recordings')
    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(api.admin.removeUserSubmissions).not.toHaveBeenCalled()
  })

  it('C3: "Delete account and recordings" names the count and sends withRecordings', async () => {
    render(<AdminUsers />)
    await click('Delete account and recordings')

    await waitFor(() => expect(api.users.remove).toHaveBeenCalledWith('user-1', { withRecordings: true }))
    expect(confirm.mock.calls[0][0]).toMatch(/Delete Sara Ahmed's account and their 3 recordings\?/)
    expect(await screen.findByText('Sara Ahmed and their 3 recordings were deleted.')).toBeTruthy()
  })

  it('C3: plain "Delete" says the recordings are kept, and keeps them', async () => {
    render(<AdminUsers />)
    await click('Delete')

    await waitFor(() => expect(api.users.remove).toHaveBeenCalledWith('user-1', { withRecordings: false }))
    expect(confirm.mock.calls[0][0]).toMatch(/keeps their 3 recordings/)
  })

  it('C3: a partial failure is shown, with the number that failed', async () => {
    api.admin.removeUserSubmissions.mockResolvedValue({ deleted: 2, failed: [{ id: 's3', reason: 'x' }] })
    render(<AdminUsers />)
    await click('Delete recordings')
    expect(await screen.findByText('Deleted 2, but 1 could not be deleted from storage. Try again.')).toBeTruthy()
  })
})

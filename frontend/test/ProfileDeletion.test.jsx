import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ProfileDashboard from '../src/pages/ProfileDashboard'

const { auth, deleteAccount } = vi.hoisted(() => ({
  auth: { value: null },
  deleteAccount: vi.fn(),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => auth.value,
}))

vi.mock('../src/context/LibraryContext', () => ({
  useLibrary: () => ({
    categories: [],
    videosIn: () => [],
    hasSubmission: () => false,
    mySubmissions: [],
    publishedVideos: [],
    orderedPublished: [],
    contributedCount: 0,
    totalSubmissionCount: 0,
  }),
}))

function renderProfile() {
  auth.value = {
    user: {
      id: 'user-1',
      firstName: 'Sara',
      surname: 'Khan',
      email: 'sara@example.com',
      createdAt: Date.now(),
      connections: {},
    },
    isAdmin: false,
    logout: vi.fn(),
    deleteAccount,
    saveConnections: vi.fn(),
  }
  return render(<MemoryRouter><ProfileDashboard /></MemoryRouter>)
}

describe('profile account deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteAccount.mockResolvedValue(undefined)
  })

  afterEach(cleanup)

  it('warns that recordings remain and requires the current password in its confirmation dialog', async () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Delete your account?' })
    expect(dialog.textContent).toContain('submitted recordings and related contribution data will remain stored')
    expect(dialog.textContent).toContain('already used in a released model cannot be removed')
    expect(dialog.textContent).toContain('Request recording/data deletion')

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'password1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Permanently delete account' }))

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('password1'))
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UploadQueueProvider from '../src/context/UploadQueueProvider'
import { useUploadQueue } from '../src/context/UploadQueueContext'

const { api, notify } = vi.hoisted(() => ({
  api: { submissions: { upload: vi.fn() } },
  notify: vi.fn(),
}))

vi.mock('../src/services/api', () => ({ api }))
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('../src/context/NotificationContext', () => ({ useNotifications: () => ({ notify }) }))

function QueueHarness() {
  const queue = useUploadQueue()
  const recording = { blob: new Blob(['video']), edit: { start: 0, end: 2, mirrored: false }, duration: 2 }
  return (
    <>
      <button onClick={() => queue.enqueue({ id: 'video-1', title: 'First video' }, recording)}>Queue first</button>
      <button onClick={() => queue.enqueue({ id: 'video-2', title: 'Second video' }, recording)}>Queue second</button>
      <button onClick={() => queue.enqueue({ id: 'video-3', title: 'Third video' }, recording)}>Queue third</button>
      <output aria-label="queued uploads">{queue.items.map(({ title, status }) => `${title}: ${status}`).join('; ')}</output>
    </>
  )
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('UploadQueueProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notify.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('serializes two queued uploads and retries a failure', async () => {
    const firstAttempt = deferred()
    const firstRetry = deferred()
    const secondUpload = deferred()
    api.submissions.upload
      .mockReturnValueOnce(firstAttempt.promise)
      .mockReturnValueOnce(firstRetry.promise)
      .mockReturnValueOnce(secondUpload.promise)

    render(
      <UploadQueueProvider>
        <QueueHarness />
      </UploadQueueProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Queue first' }))
    await waitFor(() => expect(api.submissions.upload).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Queue second' }))
    fireEvent.click(screen.getByRole('button', { name: 'Queue third' }))

    expect(screen.getByText(/First video: uploading; Second video: waiting/)).toBeTruthy()
    expect(api.submissions.upload).toHaveBeenCalledTimes(1)

    firstAttempt.reject(new Error('Network unavailable'))
    await screen.findByText(/First video: failed/)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(api.submissions.upload).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('queued uploads').textContent).toBe('First video: waiting; Second video: uploading')

    firstRetry.resolve({ id: 'submission-1' })
    await waitFor(() => expect(api.submissions.upload).toHaveBeenCalledTimes(3))
    expect(screen.getByLabelText('queued uploads').textContent).toBe('First video: uploading')

    secondUpload.resolve({ id: 'submission-2' })
    await waitFor(() => expect(screen.getByLabelText('queued uploads').textContent).toBe(''))
    expect(notify).toHaveBeenCalledTimes(3)
  })

  it('shows the remaining cooldown time from a rejected upload in the toast', async () => {
    api.submissions.upload.mockRejectedValueOnce(
      Object.assign(new Error('Wait 17s before recording this video again.'), { status: 409 }),
    )

    render(
      <UploadQueueProvider>
        <QueueHarness />
      </UploadQueueProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Queue first' }))

    expect(await screen.findByText(/Wait 17s before recording this video again\./)).toBeTruthy()
    expect(screen.getByText('Upload failed')).toBeTruthy()
  })
})

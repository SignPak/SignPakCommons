import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminVideos from '../src/pages/admin/AdminVideos'

const { addVideo, useLibrary } = vi.hoisted(() => ({
  addVideo: vi.fn(),
  useLibrary: vi.fn(),
}))

vi.mock('../src/context/LibraryContext', () => ({ useLibrary }))
vi.mock('../src/pages/admin/AdminDemoVideo', () => ({ default: () => null }))
vi.mock('../src/components/VideoPrep', () => ({
  default: ({ onReady }) => (
    <button
      type="button"
      onClick={() => onReady({
        file: new File(['prepared video'], 'prepared.mp4', { type: 'video/mp4' }),
        durationSec: 3,
        width: 640,
        height: 360,
        poster: 'data:image/jpeg;base64,auto-frame',
      })}
    >
      Finish video prep
    </button>
  ),
}))

const library = () => ({ videos: [], categories: [], addVideo })

function renderAdminVideos() {
  useLibrary.mockReturnValue(library())
  return render(<AdminVideos />)
}

function chooseVideo() {
  const input = screen.getByText('Choose a video').closest('label').querySelector('input')
  fireEvent.change(input, {
    target: { files: [new File(['video'], 'hello.mp4', { type: 'video/mp4' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Finish video prep' }))
}

describe('AdminVideos poster selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    addVideo.mockResolvedValue({})
  })

  afterEach(cleanup)

  it('requires an explicit poster image or auto-frame choice', async () => {
    renderAdminVideos()
    chooseVideo()

    expect(screen.getByRole('button', { name: 'Upload video' }).disabled).toBe(true)

    const autoFrame = screen.getByRole('checkbox', { name: /auto-generated frame/i })
    fireEvent.click(autoFrame)
    expect(screen.getByRole('button', { name: 'Upload video' }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Upload video' }))

    await waitFor(() => expect(addVideo).toHaveBeenCalledOnce())
    expect(addVideo.mock.calls[0][0].poster).toBe('data:image/jpeg;base64,auto-frame')
  })

  it('uploads a selected poster image instead of the auto-generated frame', async () => {
    renderAdminVideos()
    chooseVideo()
    const poster = new File(['poster image'], 'custom.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/Poster image/), { target: { files: [poster] } })

    expect(screen.getByRole('button', { name: 'Upload video' }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Upload video' }))

    await waitFor(() => expect(addVideo).toHaveBeenCalledOnce())
    expect(addVideo.mock.calls[0][0].poster).toBe(poster)
  })

  it('adds a direct HTTPS video URL with a required poster instead of uploading video bytes', async () => {
    renderAdminVideos()
    fireEvent.change(screen.getByLabelText('Video source'), { target: { value: 'url' } })
    fireEvent.change(screen.getByLabelText('Direct HTTPS video URL'), {
      target: { value: 'https://media.example.test/sign.mp4' },
    })
    fireEvent.change(screen.getByLabelText(/Poster image/), {
      target: { files: [new File(['poster image'], 'poster.png', { type: 'image/png' })] },
    })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'External sign' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add video URL' }))

    await waitFor(() => expect(addVideo).toHaveBeenCalledOnce())
    expect(addVideo.mock.calls[0][0]).toMatchObject({
      title: 'External sign',
      videoUrl: 'https://media.example.test/sign.mp4',
      file: null,
      durationSec: 0,
      width: 0,
      height: 0,
    })
    expect(addVideo.mock.calls[0][0].poster).toBeInstanceOf(File)
  })
})

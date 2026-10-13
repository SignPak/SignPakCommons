import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecorder } from '../src/hooks/useRecorder'
import RecorderPanel from '../src/components/RecorderPanel'

vi.mock('../src/hooks/useRecorder', () => ({
  useRecorder: vi.fn(),
}))

const defaultRecorder = {
  recording: null,
  status: 'idle',
  error: '',
  elapsed: 0,
  stream: null,
  prepare: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  discard: vi.fn(),
}

function renderPanel(overrides = {}, props = {}) {
  useRecorder.mockReturnValue({ ...defaultRecorder, ...overrides })
  return render(
    <RecorderPanel
      video={{ id: 'video-1' }}
      baseRef={{ current: null }}
      onSaveAndEdit={vi.fn()}
      {...props}
    />,
  )
}

describe('RecorderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaultRecorder.prepare.mockResolvedValue(true)
    defaultRecorder.start.mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('prepares the camera and starts capture after the three-second countdown', async () => {
    vi.useFakeTimers()
    const baseVideo = {
      paused: true,
      ended: false,
      play: vi.fn().mockResolvedValue(undefined),
    }
    renderPanel({}, { baseRef: { current: baseVideo }, aspect: '16 / 9' })

    expect(screen.getByText('Your camera preview will appear here.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /start recording/i }).disabled).toBe(false)
    expect(screen.getByText(/Watch the example, then make it yours/)).toBeTruthy()
    expect(document.querySelector('.recorder-stage').style.getPropertyValue('--video-ar')).toBe('16 / 9')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    })

    expect(defaultRecorder.prepare).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toContain('3')
    expect(screen.getByRole('button', { name: /starting in 3/i }).disabled).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(defaultRecorder.start).toHaveBeenCalledOnce()
    expect(baseVideo.play).toHaveBeenCalledOnce()
    expect(screen.getByText('Your turn')).toBeTruthy()
  })

  it('does not start a countdown when camera preparation fails', async () => {
    defaultRecorder.prepare.mockResolvedValue(false)
    renderPanel()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }))
    })

    expect(defaultRecorder.prepare).toHaveBeenCalledOnce()
    expect(defaultRecorder.start).not.toHaveBeenCalled()
    expect(screen.queryByText('Get ready')).toBeNull()
    expect(screen.getByRole('button', { name: /start recording/i }).disabled).toBe(false)
  })

  it('shows a live recording status and lets the user stop recording', () => {
    renderPanel({ status: 'recording', elapsed: 12 })

    expect(screen.getByText('Recording 00:12')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(defaultRecorder.stop).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /save and edit video/i }).disabled).toBe(true)
  })

  it('lets the user review, delete, or save a finished take', () => {
    const recording = { url: 'blob:recording-1' }
    const onSaveAndEdit = vi.fn()
    renderPanel({ recording }, { onSaveAndEdit })

    expect(screen.getByLabelText('Your recording')).toBeTruthy()
    expect(screen.getByText('Recording ready')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete recording' }))
    expect(defaultRecorder.discard).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: /save and edit video/i }))
    expect(onSaveAndEdit).toHaveBeenCalledOnce()
  })

  it('displays camera errors and disables start while a request is pending', () => {
    renderPanel({
      status: 'requesting',
      error: 'Camera access was blocked.',
    })

    expect(screen.getByRole('alert').textContent).toBe('Camera access was blocked.')
    expect(screen.getByRole('button', { name: /start recording/i }).disabled).toBe(true)
  })
})

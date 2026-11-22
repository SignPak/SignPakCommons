import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageErrorBoundary from '../../src/components/PageErrorBoundary'
import { createPreloadErrorHandler, resetChunkReloadState } from '../../src/utils/chunkReload'

/** Stale chunks: what shows when a lazy page could not be loaded and reloading did not help. */

function MissingChunk() {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/ProfileDashboard-old.js')
}

beforeEach(() => {
  // React logs every error a boundary catches.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  resetChunkReloadState()
  vi.restoreAllMocks()
})

describe('page error boundary', () => {
  it('Stale chunks: a page that could not be loaded shows the error and a Reload button', () => {
    render(<><p>Header</p><PageErrorBoundary resetKey="/profile"><MissingChunk /></PageErrorBoundary></>)
    expect(screen.getByRole('alert').textContent).toContain('This page could not be loaded.Reload to try again.')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(screen.getByText('Header')).toBeTruthy()
  })

  it('Stale chunks: going to another page clears the error', () => {
    const { rerender } = render(<PageErrorBoundary resetKey="/profile"><MissingChunk /></PageErrorBoundary>)
    expect(screen.getByRole('alert')).toBeTruthy()
    rerender(<PageErrorBoundary resetKey="/home"><p>Library</p></PageErrorBoundary>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Library')).toBeTruthy()
  })

  it('Stale chunks: while the reload for a new build is pending, the loading line shows instead of the error', () => {
    createPreloadErrorHandler({ getStorage: () => null, reload: () => {} })(new Event('vite:preloadError', { cancelable: true }))
    render(<PageErrorBoundary resetKey="/profile"><MissingChunk /></PageErrorBoundary>)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

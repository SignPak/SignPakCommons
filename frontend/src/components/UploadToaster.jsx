import { Button } from './ui'

const percent = (fraction) => `${Math.round((fraction || 0) * 100)}%`

/**
 * Upload status in the corner of every page. Uploads that are waiting or running cannot be closed:
 * they stay until they finish. A failed one offers Retry or Discard, and a finished one fades after a few seconds.
 */
export default function UploadToaster({ items, toasts, onRetry, onDiscard, onDismiss }) {
  if (!items.length && !toasts.length) return null
  return (
    <div className="toaster" role="region" aria-label="Recording uploads" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.status === 'failed' ? 'is-error' : ''}`}>
          {item.status === 'failed' ? (
            <>
              <p className="toast-title">Upload failed</p>
              <p className="toast-body">“{item.title}”: {item.error}</p>
              <div className="toast-actions">
                <Button onClick={() => onRetry(item.id)}>Try again</Button>
                <Button variant="outline" onClick={() => onDiscard(item.id)}>Discard recording</Button>
              </div>
            </>
          ) : (
            <>
              <p className="toast-title">{item.status === 'uploading' ? `Uploading ${percent(item.progress)}` : 'Waiting to upload'}</p>
              <p className="toast-body">“{item.title}”{item.status === 'waiting' ? ' starts when the previous upload finishes.' : ' — you can keep browsing.'}</p>
              {item.status === 'uploading' && <progress className="toast-progress" max="1" value={item.progress} aria-label={`Uploading ${item.title}`} />}
            </>
          )}
        </div>
      ))}
      {toasts.map((toast) => (
        <div key={toast.id} className="toast is-success">
          <p className="toast-title">✓ {toast.title}</p>
          <p className="toast-body">“{toast.body}” is saved. Thank you for contributing.</p>
          <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  )
}

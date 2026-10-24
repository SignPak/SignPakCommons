import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { CONSENT_VERSION, consentGiven, consentPoints } from '../utils/consent'

/**
 * mode="signup": shown right after a valid email code. The account does not exist yet; accepting creates it,
 * declining discards the sign-up. mode="existing": for an older account that never accepted the current notice.
 */
export default function Consent({ mode = 'existing' }) {
  const { user, acceptConsent, completeSignup, declineSignup, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const consentToken = location.state?.consentToken
  const dialogRef = useRef(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'signup') return

    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [mode])

  if (mode === 'signup' && !consentToken) return <Navigate to={paths.verifyEmail} replace />
  if (mode === 'existing' && (consentGiven(user) || user?.role === 'admin')) return <Navigate to={paths.library} replace />

  const submit = async (event) => {
    event.preventDefault()
    if (!agreed) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'signup') await completeSignup(consentToken, CONSENT_VERSION)
      else await acceptConsent(CONSENT_VERSION)
      navigate(paths.library, { replace: true })
    } catch (cause) {
      setError(cause.message || 'We could not save your consent. Try again.')
      setBusy(false)
    }
  }

  const decline = async () => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'signup') {
        await declineSignup(consentToken)
        navigate(paths.signup, { replace: true })
      } else {
        await logout()
      }
    } catch (cause) {
      setError(cause.message || 'We could not complete that. Try again.')
      setBusy(false)
    }
  }

  const consentForm = <>
    <form onSubmit={submit} noValidate>
      <div className="consent-notice" tabIndex={0} role="region" aria-label="Consent notice">
        {consentPoints.map((point) => <section key={point.title}>
          <h2>{point.title}</h2>
          <p>{point.body}</p>
        </section>)}
      </div>
      <label className="consent-check">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>I have read the notice and consent to my recordings being used as described.</span>
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={busy || !agreed}>{busy ? 'Saving…' : mode === 'signup' ? 'Accept and create my account' : 'Accept and continue'}</Button>
    </form>
    <Button variant="outline" block onClick={decline} disabled={busy}>{mode === 'signup' ? 'Decline and cancel sign-up' : 'Decline and log out'}</Button>
  </>

  if (mode === 'signup') {
    return (
      <main className="consent-modal-page">
        <dialog
          ref={dialogRef}
          className="consent-dialog"
          aria-labelledby="consent-title"
          aria-describedby="consent-description"
          onCancel={(event) => event.preventDefault()}
        >
          <p className="eyebrow">Consent notice</p>
          <h1 id="consent-title" className="display display-md">Before you contribute.</h1>
          <p id="consent-description" className="auth-sub">
            Your account is created once you accept how your recordings are used.
          </p>
          {consentForm}
        </dialog>
      </main>
    )
  }

  return <AuthShell
    eyebrow="Consent notice"
    title="Before you contribute."
    subtitle="Please read how your recordings are used and accept to continue."
  >
    {consentForm}
  </AuthShell>
}

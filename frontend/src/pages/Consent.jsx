import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthShell from '../components/AuthShell'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { CONSENT_VERSION, consentGiven, consentPoints } from '../utils/consent'
import { consentFormSchema } from '../utils/authSchemas'
import { applyAuthFieldErrors } from '../utils/authFormErrors'
import { consentTokenStore } from '../utils/consentTokenStore'

/**
 * mode="signup": shown right after a valid email code. The account does not exist yet; accepting creates it,
 * declining discards the sign-up. mode="existing": for an older account that never accepted the current notice.
 */
export default function Consent({ mode = 'existing' }) {
  const { user, acceptConsent, completeSignup, declineSignup, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // B4: the navigation state is lost on reload, so fall back to the copy VerifyEmail saved.
  const [consentToken] = useState(() => (mode === 'signup' ? location.state?.consentToken ?? consentTokenStore.read() : null))
  const dialogRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // B3: the step expired, or a newer sign-up replaced it. The saved token is dead; start again.
  const [expired, setExpired] = useState(false)
  const { register, handleSubmit, setError: setFieldError, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(consentFormSchema),
    defaultValues: { accepted: false },
  })
  const agreed = useWatch({ control, name: 'accepted' })

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

  const submit = async () => {
    setError('')
    try {
      if (mode === 'signup') {
        await completeSignup(consentToken, CONSENT_VERSION)
        consentTokenStore.clear()
      } else await acceptConsent(CONSENT_VERSION)
      navigate(paths.library, { replace: true })
    } catch (cause) {
      if (stepExpired(cause)) return
      if (!applyAuthFieldErrors(cause, setFieldError)) setError(cause.message || 'We could not save your consent. Try again.')
    }
  }

  /** A 400 on the sign-up step means the token no longer works: forget it and offer a fresh start. */
  function stepExpired(cause) {
    if (mode !== 'signup' || cause?.status !== 400) return false
    consentTokenStore.clear()
    setError(cause.message || 'This sign-up step has expired. Verify your email again to continue.')
    setExpired(true)
    return true
  }

  const decline = async () => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'signup') {
        await declineSignup(consentToken)
        consentTokenStore.clear()
        navigate(paths.signup, { replace: true })
      } else {
        await logout()
      }
    } catch (cause) {
      setBusy(false)
      if (stepExpired(cause)) return
      setError(cause.message || 'We could not complete that. Try again.')
    }
  }

  const consentForm = <>
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="consent-notice" tabIndex={0} role="region" aria-label="Consent notice">
        {consentPoints.map((point) => <section key={point.title}>
          <h2>{point.title}</h2>
          <p>{point.body}</p>
        </section>)}
      </div>
      <label className="consent-check">
        <input type="checkbox" {...register('accepted')} />
        <span>I have read the notice and consent to my recordings being used as described.</span>
      </label>
      {errors.accepted?.message && <Alert tone="error">{errors.accepted.message}</Alert>}
      {error && <Alert tone="error">{error}{expired && <> <Link to={paths.signup}>Sign up again</Link></>}</Alert>}
      <Button type="submit" block disabled={busy || isSubmitting || !agreed}>{isSubmitting ? 'Saving…' : mode === 'signup' ? 'Accept and create my account' : 'Accept and continue'}</Button>
    </form>
    <Button variant="outline" block onClick={decline} disabled={busy || isSubmitting}>{mode === 'signup' ? 'Decline and cancel sign-up' : 'Decline and log out'}</Button>
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

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Button } from '../components/ui'
import { paths } from '../routes/appRoutes'
import { api } from '../services/api'
import { isEmail } from '../utils/validators'

export default function ForgotPassword() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState(params.get('email') || '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const resetting = params.get('step') === 'reset'

  const requestCode = async (event) => {
    event.preventDefault()
    setError('')
    if (!isEmail(email)) { setError('Enter a valid email address.'); return }
    setBusy(true)
    try {
      const result = await api.auth.forgotPassword(email)
      setNotice(result.message)
      setParams({ email, step: 'reset' }, { replace: true })
    } catch (cause) {
      setError(cause.message || 'A reset code could not be requested.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (event) => {
    event.preventDefault()
    setError('')
    if (code.length !== 6) { setError('Enter the six-digit code from your email.'); return }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      await api.auth.resetPassword({ email, code, password, confirmPassword })
      navigate(paths.login, { replace: true, state: { notice: 'Password reset. Log in with your new password.' } })
    } catch (cause) {
      setError(cause.message || 'Your password could not be reset.')
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await api.auth.forgotPassword(email)
      setNotice(result.message)
    } catch (cause) {
      setError(cause.message || 'A reset code could not be requested.')
    } finally {
      setBusy(false)
    }
  }

  return <AuthShell
    eyebrow="Account recovery"
    title={resetting ? 'Choose a new password.' : 'Reset your password.'}
    subtitle={resetting ? 'Enter the code from your email and choose a new password.' : 'We’ll email a one-time code if an account matches.'}
    footer={<>Remembered it? <Link to={paths.login}>Log in</Link></>}
  >
    {!resetting
      ? <form onSubmit={requestCode} noValidate>
        <Field label="Email address" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block disabled={busy || !email}>{busy ? 'Requesting code…' : 'Send reset code'}</Button>
      </form>
      : <form onSubmit={reset} noValidate>
        <Field label="Email address" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        <Field label="New password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} hint="Use at least 8 characters." />
        <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {notice && <Alert tone="info">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block disabled={busy}>{busy ? 'Saving password…' : 'Reset password'}</Button>
        <Button variant="outline" block onClick={resend} disabled={busy}>Send another code</Button>
      </form>}
  </AuthShell>
}

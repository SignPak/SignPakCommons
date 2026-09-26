import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { api } from '../services/api'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  const [email, setEmail] = useState(params.get('email') || '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.emailSent === false
    ? 'We could not send the code yet. Try sending a new code.'
    : params.get('email') ? 'Enter the six-digit code sent to your email.' : '')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyEmail(email, code)
      navigate(paths.library, { replace: true })
    } catch (cause) {
      setError(cause.message || 'We could not verify that code.')
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setBusy(true)
    try {
      const response = await api.auth.resendVerification(email)
      setNotice(response.message)
    } catch (cause) {
      setError(cause.message || 'A new code could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return <AuthShell
    eyebrow="Email verification"
    title="Check your inbox."
    subtitle="Verify your email address to activate your account."
    footer={<>Already verified? <Link to={paths.login}>Log in</Link></>}
  >
    <form onSubmit={submit} noValidate>
      <Field label="Email address" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
      <Field label="Six-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      {notice && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={busy || !email || code.length !== 6}>{busy ? 'Verifying…' : 'Verify email'}</Button>
    </form>
    <Button variant="outline" block onClick={resend} disabled={busy || !email}>Send a new code</Button>
  </AuthShell>
}

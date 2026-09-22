import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Arrow, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { DEMO_ADMIN } from '../mock/data'
import { validateLogin } from '../utils/validators'

export default function Login() {
  const { login } = useAuth()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const found = validateLogin(values)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError('')
    try { await login(values.email, values.password) }
    catch (error) { setFormError(error.message); setBusy(false) }
  }

  return <AuthShell eyebrow="Welcome back" title="Good to see you." subtitle="Pick up where you left off." footer={<>New to Signpak? <Link to="/signup">Create an account</Link></>}>
    <form onSubmit={submit} noValidate>
      <Field label="Email address" name="email" type="email" value={values.email} onChange={change} error={errors.email} placeholder="you@example.com" autoComplete="email" />
      <Field label="Password" name="password" type="password" value={values.password} onChange={change} error={errors.password} placeholder="••••••••" autoComplete="current-password" />
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" block className="auth-submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'} <Arrow /></Button>
    </form>
    {import.meta.env.DEV && <p className="auth-dev">Dev only: admin login is {DEMO_ADMIN.email} / {DEMO_ADMIN.password}</p>}
  </AuthShell>
}

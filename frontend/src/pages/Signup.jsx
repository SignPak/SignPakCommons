import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Arrow, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { api } from '../services/api'
import { validateSignup } from '../utils/validators'

const EMPTY = { firstName: '', surname: '', email: '', password: '', confirmPassword: '' }

export default function Signup() {
  const { signup } = useAuth()
  const { notify } = useNotifications()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const found = validateSignup(values)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setFormError('')
    try {
      await signup(values) // GuestOnly redirects once the session exists
      const session = await api.auth.session() // fresh read: safe even before NotificationProvider re-renders with the new user
      if (session) notify({ type: 'welcome', title: 'Welcome to Signpak Commons', body: 'Pick any category and record your first video whenever you\'re ready.' }, session.id)
    } catch (error) { setFormError(error.message); setBusy(false) }
  }

  return <AuthShell eyebrow="Start your journey" title="Create your account." subtitle="A few details, then you're in." footer={<>Already have an account? <Link to="/login">Log in</Link></>}>
    <form onSubmit={submit} noValidate>
      <div className="field-row">
        <Field label="First name" name="firstName" value={values.firstName} onChange={change} error={errors.firstName} placeholder="Maya" autoComplete="given-name" />
        <Field label="Surname" name="surname" value={values.surname} onChange={change} error={errors.surname} placeholder="Rivera" autoComplete="family-name" />
      </div>
      <Field label="Email address" name="email" type="email" value={values.email} onChange={change} error={errors.email} placeholder="you@example.com" autoComplete="email" />
      <Field label="Password" name="password" type="password" value={values.password} onChange={change} error={errors.password} hint="Use at least 8 characters." placeholder="••••••••" autoComplete="new-password" />
      <Field label="Confirm password" name="confirmPassword" type="password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} placeholder="••••••••" autoComplete="new-password" />
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" block className="auth-submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <Arrow /></Button>
    </form>
  </AuthShell>
}

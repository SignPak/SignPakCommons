import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Arrow, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { loginFormSchema } from '../utils/authSchemas'
import { applyAuthFieldErrors } from '../utils/authFormErrors'

export default function Login() {
  const { login } = useAuth()
  const location = useLocation()
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const submit = async (values) => {
    setFormError('')
    try { 
      await login(values.email, values.password) 
    } catch (error) { 
      if (!applyAuthFieldErrors(error, setError)) setFormError(error.message)
    }
  }

  return ( 
    <AuthShell 
      eyebrow="Welcome back" 
      title="Good to see you." 
      subtitle="Pick up where you left off." 
      footer={
        <>
          New to Signpak? <Link to={paths.signup}>Create an account</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <Field 
          label="Email address" 
          type="email" 
          {...register('email')}
          error={errors.email?.message}
          placeholder="you@example.com" 
          autoComplete="email" 
        />
        <Field 
          label="Password" 
          type="password" 
          {...register('password')}
          error={errors.password?.message}
          placeholder="••••••••" 
          autoComplete="current-password" 
        />
        <p className="auth-footer">
          <Link to={paths.forgotPassword}>Forgot password?</Link> · <Link to={paths.verifyEmail}>Verify email</Link>
        </p>
        {location.state?.notice && <Alert tone="success">{location.state.notice}</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" block className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'} <Arrow />
        </Button>
      </form>
    </AuthShell>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Arrow, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { signupFormSchema } from '../utils/authSchemas'
import { applyAuthFieldErrors } from '../utils/authFormErrors'

const EMPTY = { firstName: '', surname: '', email: '', password: '', confirmPassword: '' }

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(signupFormSchema),
    defaultValues: EMPTY,
  })

  const submit = async (values) => {
    setFormError('')
    try {
      const result = await signup(values)
      navigate(`${paths.verifyEmail}?email=${encodeURIComponent(result.email)}`, { replace: true, state: { emailSent: result.verificationEmailSent } })
    } catch (error) { 
      if (!applyAuthFieldErrors(error, setError)) setFormError(error.message)
    }
  }

  return (
    <AuthShell 
      eyebrow="Start your journey" 
      title="Create your account." 
      subtitle="A few details, then verify your email to get started." 
      footer={
        <>
          Already signed up? <Link to={paths.verifyEmail}>Verify your email</Link> · <Link to={paths.login}>Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="field-row">
          <Field 
            label="First name" 
            {...register('firstName')}
            error={errors.firstName?.message}
            placeholder="Maya" 
            autoComplete="given-name" 
          />
          <Field 
            label="Surname" 
            {...register('surname')}
            error={errors.surname?.message}
            placeholder="Rivera" 
            autoComplete="family-name" 
          />
        </div>
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
          hint="Use at least 8 characters." 
          placeholder="••••••••" 
          autoComplete="new-password" 
        />
        <Field 
          label="Confirm password" 
          type="password" 
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
          placeholder="••••••••" 
          autoComplete="new-password" 
        />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" block className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'} <Arrow />
        </Button>
      </form>
    </AuthShell>
  )
}

'use client'

import { useActionState } from 'react'
import { signIn, type LoginState } from '@/lib/actions/auth'
import { Alert, Field, buttonClass, inputClass } from '@/components/ui'

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {})
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : notice ? <Alert tone="info">{notice}</Alert> : null}
      <Field label="Email" name="email" required>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={inputClass} />
      </Field>
      <Field label="Password" name="password" required>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass('primary', 'w-full')}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

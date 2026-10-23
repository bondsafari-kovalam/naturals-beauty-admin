'use client'

import { useActionState } from 'react'
import { createCategory } from '@/lib/actions/categories'
import { Alert, Field, SubmitButton, inputClass } from '@/components/ui'

export function CategoryForm() {
  const [state, action, pending] = useActionState(createCategory, {})
  const error = state.fieldErrors?.name
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && !error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Category name" name="name" required error={error} hint="For example: Bridal Makeup. It appears in the course form and as a filter on the website.">
        <input id="name" name="name" maxLength={100} required defaultValue={state.values?.name} className={inputClass}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'name-error' : undefined} />
      </Field>
      <div><SubmitButton pending={pending}>+ Add category</SubmitButton></div>
    </form>
  )
}

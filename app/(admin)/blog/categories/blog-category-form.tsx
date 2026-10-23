'use client'

import { useActionState } from 'react'
import { createBlogCategory } from '@/lib/actions/blog'
import { Alert, Field, SubmitButton, inputClass } from '@/components/ui'

export function BlogCategoryForm() {
  const [state, action, pending] = useActionState(createBlogCategory, {})
  const error = state.fieldErrors?.name
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && !error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Category name" name="name" required error={error} hint="For example: Sun Care. It appears in the post form and as a filter on the website’s blog.">
        <input id="name" name="name" maxLength={100} required defaultValue={state.values?.name} className={inputClass}
          aria-invalid={error ? true : undefined} aria-describedby={error ? 'name-error' : undefined} />
      </Field>
      <div><SubmitButton pending={pending}>+ Add category</SubmitButton></div>
    </form>
  )
}

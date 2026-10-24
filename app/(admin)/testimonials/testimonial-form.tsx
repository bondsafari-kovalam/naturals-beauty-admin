'use client'

import { useActionState } from 'react'
import type { CourseFormState } from '@/lib/actions/courses'
import type { TestimonialRow } from '@/lib/testimonials'
import { Card, Field, SubmitButton, inputClass } from '@/components/ui'
import { FormErrorSummary } from '@/components/form-error-summary'

type Props = { action: (prev: CourseFormState, formData: FormData) => Promise<CourseFormState>; testimonial?: TestimonialRow; submitLabel: string }

export function TestimonialForm({ action, testimonial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}
  const v = state.values
  const invalid = (name: string) => errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}

  return <form action={formAction} className="flex flex-col gap-6" noValidate>
    <FormErrorSummary message={state.error} fieldErrors={state.fieldErrors} />
    <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
      <Field label="Student name" name="name" required error={errors.name} hint="e.g. Anjali R. — use only what the student agreed to show."><input id="name" name="name" maxLength={120} className={inputClass} defaultValue={v?.name ?? testimonial?.name ?? ''} {...invalid('name')} /></Field>
      <Field label="Course" name="course" error={errors.course} hint="e.g. Makeup Artistry"><input id="course" name="course" maxLength={200} className={inputClass} defaultValue={v?.course ?? testimonial?.course ?? ''} {...invalid('course')} /></Field>
      <Field label="Location" name="location" error={errors.location} hint="e.g. Alappuzha"><input id="location" name="location" maxLength={120} className={inputClass} defaultValue={v?.location ?? testimonial?.location ?? ''} {...invalid('location')} /></Field>
      <Field label="Rating" name="rating" required error={errors.rating}>
        <select id="rating" name="rating" className={inputClass} defaultValue={v?.rating ?? testimonial?.rating ?? 5} {...invalid('rating')}>
          {[5, 4, 3, 2, 1].map((stars) => <option key={stars} value={stars}>{'★'.repeat(stars)} ({stars})</option>)}
        </select>
      </Field>
      <div className="md:col-span-2"><Field label="Testimonial" name="quote" required error={errors.quote} hint="The student’s own words, up to 1000 characters."><textarea id="quote" name="quote" maxLength={1000} className={`${inputClass} min-h-32`} defaultValue={v?.quote ?? testimonial?.quote ?? ''} {...invalid('quote')} /></Field></div>
      <Field label="Display order" name="sort_order" error={errors.sort_order} hint="Lower numbers show first on the homepage."><input id="sort_order" name="sort_order" type="number" min={0} className={inputClass} defaultValue={v?.sort_order ?? testimonial?.sort_order ?? 0} {...invalid('sort_order')} /></Field>
    </Card>
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="is_published" defaultChecked={v ? v.is_published === 'on' : testimonial?.is_published ?? false} className="mt-0.5 h-4 w-4 accent-brand-deep" /><span><strong className="block text-ink">Published</strong><span className="text-muted">Show this testimonial on the homepage. Publish only real, approved student testimonials.</span></span></label>
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </Card>
  </form>
}

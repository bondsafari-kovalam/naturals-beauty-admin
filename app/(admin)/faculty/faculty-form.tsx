'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import type { CourseFormState } from '@/lib/actions/courses'
import { Card, Field, SubmitButton, inputClass } from '@/components/ui'
import { compressImage } from '@/lib/compress-image'
import { FACULTY_SECTION_LABELS, FACULTY_SECTIONS, type FacultyRow } from '@/lib/faculty'
import { FormErrorSummary } from '@/components/form-error-summary'

type Props = { action: (prev: CourseFormState, formData: FormData) => Promise<CourseFormState>; faculty?: FacultyRow; publicSiteUrl: string; submitLabel: string }

export function FacultyForm({ action, faculty, publicSiteUrl, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}
  const v = state.values
  const image = v?.image_url ?? faculty?.image_url ?? ''
  // The newly chosen file (compressed when over 5 MB) is previewed straight away and sent on save.
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageError, setImageError] = useState('')
  const [compressing, setCompressing] = useState(false)
  const preview = imagePreview || (image.startsWith('/') ? `${publicSiteUrl}${image}` : image)
  const invalid = (name: string) => errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}

  // Free the previous preview's memory when it is replaced or the form closes.
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  return <form action={formAction} onSubmit={(event) => {
    if (!selectedImage) return
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('image_file', selectedImage)
    startTransition(() => formAction(formData))
  }} className="flex flex-col gap-6" noValidate>
    <FormErrorSummary message={state.error} fieldErrors={state.fieldErrors} />
    <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
      <Field label="Name" name="name" required error={errors.name}><input id="name" name="name" className={inputClass} defaultValue={v?.name ?? faculty?.name ?? ''} {...invalid('name')} /></Field>
      <Field label="Role" name="role" required error={errors.role}><input id="role" name="role" className={inputClass} placeholder="e.g. Makeup Artistry Trainer" defaultValue={v?.role ?? faculty?.role ?? ''} {...invalid('role')} /></Field>
      <Field label="Department" name="department" required error={errors.department}><input id="department" name="department" className={inputClass} placeholder="e.g. Makeup & Bridal" defaultValue={v?.department ?? faculty?.department ?? ''} {...invalid('department')} /></Field>
      <Field label="Profile type" name="section" required error={errors.section}>
        <select id="section" name="section" className={inputClass} defaultValue={v?.section ?? faculty?.section ?? 'trainer'} {...invalid('section')}>
          {FACULTY_SECTIONS.map((section) => <option key={section} value={section}>{FACULTY_SECTION_LABELS[section]}</option>)}
        </select>
      </Field>
      <Field label="Experience" name="experience" error={errors.experience} hint="e.g. 12+ years"><input id="experience" name="experience" className={inputClass} defaultValue={v?.experience ?? faculty?.experience ?? ''} {...invalid('experience')} /></Field>
      <Field label="Display order" name="sort_order" error={errors.sort_order} hint="Position within its group (academy head, senior faculty or trainers): 1 = first. Leave 0 to place last."><input id="sort_order" name="sort_order" type="number" min={0} className={inputClass} defaultValue={v?.sort_order ?? faculty?.sort_order ?? 0} {...invalid('sort_order')} /></Field>
      <div className="md:col-span-2"><Field label="Bio" name="bio" error={errors.bio}><textarea id="bio" name="bio" className={`${inputClass} min-h-28`} defaultValue={v?.bio ?? faculty?.bio ?? ''} {...invalid('bio')} /></Field></div>
      <div className="md:col-span-2"><Field label="Specialities" name="specialities" error={errors.specialities} hint="One speciality per line"><textarea id="specialities" name="specialities" className={`${inputClass} min-h-24`} defaultValue={v?.specialities ?? faculty?.specialities.join('\n') ?? ''} {...invalid('specialities')} /></Field></div>
    </Card>
    <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_220px]">
      <div className="flex flex-col gap-5">
        <input type="hidden" name="image_url" value={faculty?.image_url ?? '/placeholder-user.jpg'} />
        <Field label={faculty ? 'Replace image' : 'Upload image'} name="image_file" error={imageError || errors.image_file || (errors.image_url ? 'Upload an image.' : undefined)} hint="JPG, PNG, WebP or AVIF. Images over 5 MB are compressed automatically."><input id="image_file" name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className={inputClass} onChange={async (event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          setImageError('')
          if (!file) { setSelectedImage(null); setImagePreview(''); return }
          setCompressing(true)
          try { const upload = await compressImage(file); setSelectedImage(upload); setImagePreview(URL.createObjectURL(upload)) }
          catch (error) { input.value = ''; setSelectedImage(null); setImagePreview(''); setImageError(error instanceof Error ? error.message : 'Could not use this image.') }
          finally { setCompressing(false) }
        }} /></Field>
      </div>
      <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded border border-line bg-soft text-center text-xs text-muted">{preview ? <img src={preview} alt="Image preview" className="h-full w-full object-cover" /> : 'Image preview'}</div>
    </Card>
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="is_published" defaultChecked={v ? v.is_published === 'on' : faculty?.is_published ?? false} className="mt-0.5 h-4 w-4 accent-brand-deep" /><span><strong className="block text-ink">Published</strong><span className="text-muted">Show this profile on the public faculty page.</span></span></label>
      <SubmitButton pending={pending} disabled={compressing}>{compressing ? 'Compressing…' : submitLabel}</SubmitButton>
    </Card>
  </form>
}

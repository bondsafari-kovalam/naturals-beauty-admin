'use client'

import { startTransition, useActionState, useState } from 'react'
import { slugify, type CourseRow } from '@/lib/courses'
import type { CourseFormState } from '@/lib/actions/courses'
import { Alert, Card, Field, SubmitButton, inputClass } from '@/components/ui'
import { compressImage } from '@/lib/compress-image'
import { CurriculumEditor } from './curriculum-editor'

type Props = {
  action: (prev: CourseFormState, formData: FormData) => Promise<CourseFormState>
  course?: CourseRow
  categories: string[]
  publicSiteUrl: string
  submitLabel: string
}

export function CourseForm({ action, course, categories, publicSiteUrl, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const [title, setTitle] = useState(course?.title ?? '')
  const [slug, setSlug] = useState(course?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(course))
  const imageUrl = course?.image_url ?? ''
  const [imagePreview, setImagePreview] = useState('')
  const [imageError, setImageError] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [compressing, setCompressing] = useState(false)
  const errors = state.fieldErrors ?? {}
  const v = state.values
  const initialCurriculum = v?.curriculum ? (JSON.parse(v.curriculum) as CourseRow['curriculum']) : course?.curriculum ?? []
  const previewSrc = imagePreview || (imageUrl.startsWith('/') ? `${publicSiteUrl}${imageUrl}` : imageUrl.startsWith('https://') ? imageUrl : '')
  const invalid = (name: string) => (errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {})

  return (
    <form action={formAction} onSubmit={(event) => {
      if (!selectedImage) return
      event.preventDefault()
      const formData = new FormData(event.currentTarget)
      formData.set('image_file', selectedImage)
      // A manual call must run inside a transition, or `pending` never updates (React warns about this).
      startTransition(() => formAction(formData))
    }} className="flex flex-col gap-6" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Title" name="title" required error={errors.title}>
            <input id="title" name="title" className={inputClass} value={title} {...invalid('title')}
              onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)) }} />
          </Field>
        </div>
        <Field label="Slug (web address)" name="slug" required error={errors.slug} hint={`Page address: /courses/${slug || 'your-slug'}`}>
          <input id="slug" name="slug" className={inputClass} value={slug} {...invalid('slug')}
            onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }} />
        </Field>
        <Field label="Category" name="category" required error={errors.category} hint="Need a new one? Add it on the Categories page first.">
          <select id="category" name="category" className={inputClass} defaultValue={v?.category ?? course?.category ?? ''} {...invalid('category')}>
            <option value="" disabled>Choose a category</option>
            {/* Keep a course's current category selectable even if it was removed from the list. */}
            {course && !categories.includes(course.category) && <option value={course.category}>{course.category}</option>}
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Description" name="description" required error={errors.description} hint="Shown on the course card, the course page and in Google results.">
            <textarea id="description" name="description" className={`${inputClass} min-h-24`} defaultValue={v?.description ?? course?.description} {...invalid('description')} />
          </Field>
        </div>
        <Field label="Duration" name="duration" error={errors.duration} hint="As shown on the website, e.g. 360 Hrs">
          <input id="duration" name="duration" className={inputClass} defaultValue={v?.duration ?? course?.duration ?? ''} {...invalid('duration')} />
        </Field>
        <Field label="Position on website" name="sort_order" error={errors.sort_order} hint={course ? '1 = first course. Other courses move down to make room.' : '1 = first course. Leave empty to add it at the end.'}>
          <input id="sort_order" name="sort_order" type="number" min={1} step={1} className={inputClass} defaultValue={v?.sort_order ?? course?.sort_order ?? ''} {...invalid('sort_order')} />
        </Field>
      </Card>

      <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-5">
          {/* The stored URL stays hidden; admins only see the preview and replace it by uploading. */}
          <input type="hidden" name="image_url" value={imageUrl} />
          <Field label={imageUrl ? 'Replace image' : 'Upload image'} name="image_file" required={!imageUrl} error={imageError || errors.image_file || (errors.image_url && !selectedImage ? 'Upload an image.' : undefined)} hint="JPG, PNG, WebP or AVIF. Images over 5 MB are compressed automatically.">
            <input id="image_file" name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white`} onChange={async (event) => {
              const file = event.target.files?.[0]
              setImageError('')
              setSelectedImage(null)
              if (!file) return
              setCompressing(true)
              try {
                const uploadFile = await compressImage(file)
                setSelectedImage(uploadFile)
                setImagePreview(URL.createObjectURL(uploadFile))
              } catch (error) {
                event.currentTarget.value = ''
                setImagePreview('')
                setImageError(error instanceof Error ? error.message : 'Could not compress this image.')
              } finally {
                setCompressing(false)
              }
            }} />
          </Field>
        </div>
        <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded border border-line bg-soft text-center text-xs text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- previews arbitrary admin-entered URLs */}
          {previewSrc ? <img src={previewSrc} alt="Image preview" className="h-full w-full object-cover" /> : 'Image preview'}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CurriculumEditor key={v?.curriculum ?? 'initial'} initial={initialCurriculum} error={errors.curriculum} />
      </Card>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="is_published" defaultChecked={v ? v.is_published === 'on' : course?.is_published ?? false} className="mt-0.5 h-4 w-4 accent-brand-deep" />
          <span><strong className="block text-ink">Published</strong><span className="text-muted">Visible on the public website. Leave unticked to keep it as a draft.</span></span>
        </label>
        <SubmitButton pending={pending} disabled={compressing}>{compressing ? 'Compressing…' : submitLabel}</SubmitButton>
      </Card>
    </form>
  )
}

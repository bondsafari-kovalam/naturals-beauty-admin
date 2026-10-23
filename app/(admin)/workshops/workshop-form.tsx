'use client'

import { useActionState, useState } from 'react'
import type { CourseFormState } from '@/lib/actions/courses'
import { WORKSHOP_STATUSES, type WorkshopRow } from '@/lib/workshops'
import { slugify } from '@/lib/courses'
import { CopyButton } from '@/components/copy-button'
import { Alert, Card, Field, SubmitButton, inputClass } from '@/components/ui'

type Props = { action: (prev: CourseFormState, formData: FormData) => Promise<CourseFormState>; workshop?: WorkshopRow; publicSiteUrl: string; submitLabel: string }
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const COMPRESSED_IMAGE_TARGET = MAX_IMAGE_SIZE - 100 * 1024
const text = (items: string[] | undefined) => items?.join('\n') ?? ''
const agenda = (items: { time: string; title: string }[] | undefined) => items?.map((item) => `${item.time} | ${item.title}`).join('\n') ?? ''
const faqs = (items: [string, string][] | undefined) => items?.map(([question, answer]) => `${question} | ${answer}`).join('\n') ?? ''

async function compressImage(file: File) {
  if (file.size <= MAX_IMAGE_SIZE) return file
  const bitmap = await createImageBitmap(file)
  try {
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare this image for upload.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', Math.max(0.35, 0.85 - attempt * 0.08)))
      if (blob && blob.size <= COMPRESSED_IMAGE_TARGET) {
        const name = file.name.replace(/\.[^.]+$/, '') || 'workshop-image'
        return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
      }
      scale *= 0.8
    }
  } finally {
    bitmap.close()
  }
  throw new Error('This image could not be compressed below 5 MB.')
}

export function WorkshopForm({ action, workshop, publicSiteUrl, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}; const v = state.values; const image = v?.image_url ?? workshop?.image_url ?? ''; const [imagePreview, setImagePreview] = useState(''); const [imageError, setImageError] = useState(''); const preview = imagePreview || (image.startsWith('/') ? `${publicSiteUrl}${image}` : image)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [title, setTitle] = useState(v?.title ?? workshop?.title ?? '')
  const [slug, setSlug] = useState(v?.slug ?? workshop?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(workshop))
  const campaignUrl = `${publicSiteUrl}/workshops/${slug || 'your-workshop'}`
  const invalid = (name: string) => errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}
  return <form action={formAction} onSubmit={(event) => {
    if (!selectedImage) return
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('image_file', selectedImage)
    formAction(formData)
  }} className="flex flex-col gap-6" noValidate>
    {state.error && <Alert tone="error">{state.error}</Alert>}
    <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
      <div className="md:col-span-2"><Field label="Title" name="title" required error={errors.title}><input id="title" name="title" className={inputClass} value={title} onChange={(event) => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)) }} {...invalid('title')} /></Field></div>
      <div className="md:col-span-2"><Field label="Campaign URL" name="slug" required error={errors.slug} hint={`Share this link in Instagram and Facebook posts: ${campaignUrl}`}>
        <div className="flex gap-2"><input id="slug" name="slug" className={inputClass} value={slug} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true) }} {...invalid('slug')} /><CopyButton text={campaignUrl} label="Copy link" /></div>
      </Field>{workshop?.status === 'published' && slug !== workshop.slug && <p className="mt-1 text-xs text-amber-700">Changing the URL of a published workshop breaks links already shared in ads and posts.</p>}</div>
      <div className="md:col-span-2"><Field label="Short description" name="short_description" error={errors.short_description} hint="One or two lines for the workshop card and link previews on WhatsApp, Instagram and Facebook (max 300 characters)."><textarea id="short_description" name="short_description" maxLength={300} className={`${inputClass} min-h-20`} defaultValue={v?.short_description ?? workshop?.short_description ?? ''} {...invalid('short_description')} /></Field></div>
      <Field label="Date" name="date" required error={errors.date}><input id="date" name="date" type="date" className={inputClass} defaultValue={v?.date ?? workshop?.date ?? ''} {...invalid('date')} /></Field>
      <Field label="Start time" name="start_time" required error={errors.start_time}><input id="start_time" name="start_time" type="time" className={inputClass} defaultValue={v?.start_time?.slice(0, 5) ?? workshop?.start_time?.slice(0, 5) ?? '10:00'} {...invalid('start_time')} /></Field>
      <Field label="Time shown" name="time_label" required error={errors.time_label}><input id="time_label" name="time_label" className={inputClass} placeholder="10:00 AM – 4:00 PM" defaultValue={v?.time_label ?? workshop?.time_label ?? ''} {...invalid('time_label')} /></Field>
      <Field label="Duration" name="duration" required error={errors.duration}><input id="duration" name="duration" className={inputClass} placeholder="1 day" defaultValue={v?.duration ?? workshop?.duration ?? ''} {...invalid('duration')} /></Field>
      <Field label="Category" name="category" required error={errors.category}><input id="category" name="category" className={inputClass} defaultValue={v?.category ?? workshop?.category ?? ''} {...invalid('category')} /></Field>
      <Field label="Display order" name="sort_order" error={errors.sort_order}><input id="sort_order" name="sort_order" type="number" min={0} className={inputClass} defaultValue={v?.sort_order ?? workshop?.sort_order ?? 0} /></Field>
      <div className="md:col-span-2"><Field label="Description" name="description" required error={errors.description}><textarea id="description" name="description" className={`${inputClass} min-h-28`} defaultValue={v?.description ?? workshop?.description ?? ''} {...invalid('description')} /></Field></div>
      <Field label="Location" name="location" error={errors.location}><input id="location" name="location" className={inputClass} defaultValue={v?.location ?? workshop?.location ?? ''} /></Field>
      <Field label="Total seats" name="total_seats" error={errors.total_seats} hint="Registrations stop automatically when this many seats are taken. Leave empty for no limit."><input id="total_seats" name="total_seats" type="number" min={1} max={10000} className={inputClass} defaultValue={v?.total_seats ?? workshop?.total_seats ?? ''} {...invalid('total_seats')} /></Field>
      <Field label="Seats text (optional)" name="seats" error={errors.seats} hint="Shown instead of the seat count, e.g. “Only 15 seats”."><input id="seats" name="seats" className={inputClass} placeholder="Only 15 seats" defaultValue={v?.seats ?? workshop?.seats ?? ''} /></Field>
      <Field label="Fee" name="fee" error={errors.fee}><input id="fee" name="fee" className={inputClass} placeholder="Contact for fee" defaultValue={v?.fee ?? workshop?.fee ?? ''} /></Field>
    </Card>
    <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
      <Field label="What you’ll learn" name="highlights" hint="One item per line"><textarea id="highlights" name="highlights" className={`${inputClass} min-h-32`} defaultValue={v?.highlights ?? text(workshop?.highlights)} /></Field>
      <Field label="Who it’s for" name="audience" hint="One item per line"><textarea id="audience" name="audience" className={`${inputClass} min-h-32`} defaultValue={v?.audience ?? text(workshop?.audience)} /></Field>
      <Field label="What’s included" name="includes" hint="One item per line"><textarea id="includes" name="includes" className={`${inputClass} min-h-32`} defaultValue={v?.includes ?? text(workshop?.includes)} /></Field>
      <Field label="Agenda" name="agenda" hint="One per line: time | activity"><textarea id="agenda" name="agenda" className={`${inputClass} min-h-32`} defaultValue={v?.agenda ?? agenda(workshop?.agenda)} /></Field>
      <Field label="FAQs" name="faqs" hint="One per line: question | answer"><textarea id="faqs" name="faqs" className={`${inputClass} min-h-32`} defaultValue={v?.faqs ?? faqs(workshop?.faqs)} /></Field>
    </Card>
    <Card className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
      <input type="hidden" name="image_url" value={workshop?.image_url ?? ''} />
      <Field label={workshop?.image_url ? 'Replace image' : 'Upload image'} name="image_file" required={!workshop?.image_url} error={imageError || errors.image_file || (errors.image_url ? 'Upload an image.' : undefined)} hint="JPG, PNG, WebP or AVIF. Images over 5 MB are compressed automatically."><input id="image_file" name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className={inputClass} onChange={async (event) => {
        const file = event.currentTarget.files?.[0]
        if (!file) return
        setImageError('')
        setCompressing(true)
        try { const compressed = await compressImage(file); setSelectedImage(compressed); setImagePreview(URL.createObjectURL(compressed)) }
        catch (error) { event.currentTarget.value = ''; setSelectedImage(null); setImagePreview(''); setImageError(error instanceof Error ? error.message : 'Could not compress this image.') }
        finally { setCompressing(false) }
      }} /></Field>
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded border border-line bg-soft text-center text-xs text-muted">{preview ? <img src={preview} alt="Image preview" className="h-full w-full object-cover" /> : 'Image preview'}</div>
      <div className="flex flex-col gap-5"><Field label="Trainer name" name="trainer_name" hint="Optional"><input id="trainer_name" name="trainer_name" className={inputClass} defaultValue={v?.trainer_name ?? workshop?.trainer?.name ?? ''} /></Field><Field label="Trainer role" name="trainer_role"><input id="trainer_role" name="trainer_role" className={inputClass} defaultValue={v?.trainer_role ?? workshop?.trainer?.role ?? ''} /></Field><Field label="Trainer image URL" name="trainer_image"><input id="trainer_image" name="trainer_image" className={inputClass} defaultValue={v?.trainer_image ?? workshop?.trainer?.image ?? ''} /></Field></div>
    </Card>
    <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div className="grid flex-1 gap-5 sm:grid-cols-2">
      <Field label="Status" name="status" required error={errors.status} hint="Only published workshops appear on the website and accept registrations.">
        <select id="status" name="status" className={inputClass} defaultValue={v?.status ?? workshop?.status ?? 'draft'}>{WORKSHOP_STATUSES.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select>
      </Field>
      <label className="flex items-start gap-3 self-center text-sm"><input type="checkbox" name="registration_open" defaultChecked={v ? v.registration_open === 'on' : workshop?.registration_open ?? true} className="mt-0.5 h-4 w-4 accent-brand-deep" /><span><strong className="block text-ink">Registration open</strong><span className="text-muted">Untick to stop new registrations (WhatsApp enquiries still work).</span></span></label>
    </div><SubmitButton pending={pending} disabled={compressing}>{compressing ? 'Compressing…' : submitLabel}</SubmitButton></Card>
  </form>
}

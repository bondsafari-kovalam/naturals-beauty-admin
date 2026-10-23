'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminForAction } from '../dal'
import { revalidatePublicSite } from '../revalidate-site'
import { testimonialSchema } from '../testimonials'
import type { CourseFormState } from './courses'

const NOT_ADMIN = 'Your session has expired or you no longer have admin access. Please sign in again.'

function readForm(formData: FormData) {
  return {
    name: formData.get('name') ?? '', course: formData.get('course') ?? '', location: formData.get('location') ?? '',
    quote: formData.get('quote') ?? '', rating: formData.get('rating') || 5, sort_order: formData.get('sort_order') || 0,
    is_published: formData.get('is_published') === 'on',
  }
}

function snapshot(formData: FormData) {
  const values: Record<string, string> = {}
  for (const key of ['name', 'course', 'location', 'quote', 'rating', 'sort_order']) values[key] = String(formData.get(key) ?? '')
  values.is_published = formData.get('is_published') === 'on' ? 'on' : ''
  return values
}

function validate(formData: FormData) {
  const parsed = testimonialSchema.safeParse(readForm(formData))
  if (parsed.success) return { data: parsed.data }
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
  return { state: { error: 'Please fix the highlighted fields.', fieldErrors, values: snapshot(formData) } satisfies CourseFormState }
}

function databaseError(error: { code?: string; message: string }): CourseFormState {
  if (error.code === 'PGRST205') return { error: 'The testimonials table is not set up yet. Run supabase/migrations/011_testimonials.sql in the Supabase SQL Editor, then try again.' }
  if (error.code === '42501') return { error: 'The database refused this change. Check that your account is in admin_users.' }
  if (error.code === '23514') return { error: 'A value does not meet the database rules (check the lengths and rating).' }
  return { error: `Could not save the testimonial: ${error.message}` }
}

async function revalidateTestimonials() {
  revalidatePath('/testimonials', 'layout')
  await revalidatePublicSite()
}

export async function createTestimonial(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const result = validate(formData)
  if (!result.data) return result.state
  const { data, error } = await admin.supabase.from('testimonials').insert(result.data).select('id').single()
  if (error) return { ...databaseError(error), values: snapshot(formData) }
  await revalidateTestimonials()
  redirect(`/testimonials/${data.id}?saved=created`)
}

export async function updateTestimonial(id: string, _prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const result = validate(formData)
  if (!result.data) return result.state
  const { data, error } = await admin.supabase.from('testimonials').update(result.data).eq('id', id).select('id')
  if (error) return { ...databaseError(error), values: snapshot(formData) }
  if (!data?.length) return { error: 'This testimonial no longer exists, or you do not have permission to edit it.', values: snapshot(formData) }
  await revalidateTestimonials()
  redirect(`/testimonials/${id}?saved=updated`)
}

export async function setTestimonialPublished(id: string, publish: boolean) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { error } = await admin.supabase.from('testimonials').update({ is_published: publish === true }).eq('id', id)
  await revalidateTestimonials()
  redirect(error ? `/testimonials?error=${encodeURIComponent(error.message)}` : `/testimonials?saved=${publish ? 'published' : 'unpublished'}`)
}

export async function deleteTestimonial(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data, error } = await admin.supabase.from('testimonials').delete().eq('id', id).select('id')
  if (error) redirect(`/testimonials/${id}?error=${encodeURIComponent(error.message)}`)
  await revalidateTestimonials()
  redirect(data?.length ? '/testimonials?saved=deleted' : '/testimonials?error=Testimonial%20not%20found')
}

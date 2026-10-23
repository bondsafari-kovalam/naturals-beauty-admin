'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminForAction } from '../dal'
import { revalidatePublicSite } from '../revalidate-site'
import { REGISTRATION_STATUSES, WORKSHOP_STATUSES, workshopSchema, type RegistrationStatus, type WorkshopStatus } from '../workshops'
import type { CourseFormState } from './courses'

const NOT_ADMIN = 'Your session has expired or you no longer have admin access. Please sign in again.'
const BUCKET_URL_MARKER = '/storage/v1/object/public/course-images/'
const lines = (value: FormDataEntryValue | null) => String(value ?? '').split('\n').map((item) => item.trim()).filter(Boolean)
const pairs = (value: FormDataEntryValue | null) => lines(value).map((line) => { const [first, ...rest] = line.split('|'); return [first?.trim() ?? '', rest.join('|').trim()] as [string, string] }).filter(([first, second]) => first && second)

function readForm(formData: FormData) {
  const trainerName = String(formData.get('trainer_name') ?? '').trim()
  const trainerRole = String(formData.get('trainer_role') ?? '').trim()
  const trainerImage = String(formData.get('trainer_image') ?? '').trim()
  return { title: formData.get('title') ?? '', slug: formData.get('slug') ?? '', short_description: formData.get('short_description') ?? '', status: formData.get('status') ?? 'draft', total_seats: formData.get('total_seats') ?? '', registration_open: formData.get('registration_open') === 'on', date: formData.get('date') ?? '', start_time: formData.get('start_time') ?? '', time_label: formData.get('time_label') ?? '', duration: formData.get('duration') ?? '', category: formData.get('category') ?? '', description: formData.get('description') ?? '', image_url: formData.get('image_url') ?? '', location: formData.get('location') ?? '', seats: formData.get('seats') ?? '', fee: formData.get('fee') ?? '', highlights: lines(formData.get('highlights')), audience: lines(formData.get('audience')), includes: lines(formData.get('includes')), agenda: pairs(formData.get('agenda')).map(([time, title]) => ({ time, title })), trainer: trainerName && trainerRole && trainerImage ? { name: trainerName, role: trainerRole, image: trainerImage } : null, faqs: pairs(formData.get('faqs')), sort_order: formData.get('sort_order') || 0 }
}

function snapshot(formData: FormData) {
  const values: Record<string, string> = {}
  for (const key of ['title', 'slug', 'short_description', 'status', 'total_seats', 'date', 'start_time', 'time_label', 'duration', 'category', 'description', 'image_url', 'location', 'seats', 'fee', 'highlights', 'audience', 'includes', 'agenda', 'faqs', 'sort_order', 'trainer_name', 'trainer_role', 'trainer_image']) values[key] = String(formData.get(key) ?? '')
  values.registration_open = formData.get('registration_open') === 'on' ? 'on' : ''
  return values
}

function validate(formData: FormData) {
  const parsed = workshopSchema.safeParse(readForm(formData))
  if (parsed.success) return { data: parsed.data }
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
  return { state: { error: 'Please fix the highlighted fields.', fieldErrors, values: snapshot(formData) } satisfies CourseFormState }
}

function databaseError(error: { code?: string; message: string }): CourseFormState {
  if (error.code === 'PGRST205') return { error: 'The workshops table is not set up yet. Run supabase/migrations/007_workshops.sql in Supabase.' }
  if (error.code === 'PGRST204' || error.code === '42703') return { error: 'The workshop campaign columns are missing. Run supabase/migrations/010_workshop_campaigns.sql in the Supabase SQL Editor, then try again.' }
  if (error.code === '23505') return { error: 'Another workshop already uses this campaign URL.', fieldErrors: { slug: 'This URL is already taken. Campaign URLs must be unique.' } }
  if (error.code === '42501') return { error: 'The database refused this change. Check that your account is in admin_users.' }
  return { error: `Could not save the workshop: ${error.message}` }
}

function bucketPath(url: string | null | undefined) { const index = url?.indexOf(BUCKET_URL_MARKER) ?? -1; return url && index >= 0 ? decodeURIComponent(url.slice(index + BUCKET_URL_MARKER.length)) : null }

async function uploadImage(admin: Awaited<ReturnType<typeof getAdminForAction>>, formData: FormData) {
  const file = formData.get('image_file')
  if (!file || typeof file === 'string' || typeof file !== 'object') return { url: null as string | null }
  const upload = file as File
  if (upload.size === 0) return { url: null as string | null }
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' } as Record<string, string>)[upload.type]
  if (!extension) return { error: 'Upload a JPG, PNG, WebP or AVIF image.' }
  if (upload.size > 5 * 1024 * 1024) return { error: 'Image must be 5 MB or smaller.' }
  if (!admin) return { error: NOT_ADMIN }
  const path = `${admin.userId}/workshop-${crypto.randomUUID()}.${extension}`
  const { error } = await admin.supabase.storage.from('course-images').upload(path, upload, { contentType: upload.type, cacheControl: '31536000', upsert: false })
  if (error) return { error: `Could not upload image: ${error.message}` }
  return { url: admin.supabase.storage.from('course-images').getPublicUrl(path).data.publicUrl, path }
}
async function removeImage(admin: Awaited<ReturnType<typeof getAdminForAction>>, path?: string) { if (admin && path) await admin.supabase.storage.from('course-images').remove([path]) }

export async function createWorkshop(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction(); if (!admin) return { error: NOT_ADMIN }
  const uploaded = await uploadImage(admin, formData); if (uploaded.error) return { error: uploaded.error, values: snapshot(formData) }
  if (uploaded.url) formData.set('image_url', uploaded.url)
  const result = validate(formData); if (!result.data) { await removeImage(admin, uploaded.path); return result.state }
  const { data, error } = await admin.supabase.from('workshops').insert(result.data).select('id').single()
  if (error) { await removeImage(admin, uploaded.path); return { ...databaseError(error), values: snapshot(formData) } }
  await revalidateWorkshops(); redirect(`/workshops/${data.id}?saved=created`)
}

export async function updateWorkshop(id: string, _prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction(); if (!admin) return { error: NOT_ADMIN }
  const uploaded = await uploadImage(admin, formData); if (uploaded.error) return { error: uploaded.error, values: snapshot(formData) }
  if (uploaded.url) formData.set('image_url', uploaded.url)
  const result = validate(formData); if (!result.data) { await removeImage(admin, uploaded.path); return result.state }
  const { data: before } = await admin.supabase.from('workshops').select('image_url').eq('id', id).maybeSingle()
  const { data, error } = await admin.supabase.from('workshops').update(result.data).eq('id', id).select('id')
  if (error || !data?.length) { await removeImage(admin, uploaded.path); return { ...(error ? databaseError(error) : { error: 'Workshop not found.' }), values: snapshot(formData) } }
  const oldPath = bucketPath(before?.image_url); if (oldPath && before?.image_url !== result.data.image_url) await removeImage(admin, oldPath)
  await revalidateWorkshops(id); redirect(`/workshops/${id}?saved=updated`)
}

async function revalidateWorkshops(id?: string) {
  revalidatePath('/workshops', 'layout')
  if (id) revalidatePath(`/workshops/${id}`)
  revalidatePath('/', 'page')
  await revalidatePublicSite()
}

const statusMessages: Record<WorkshopStatus, string> = { draft: 'unpublished', published: 'published', completed: 'completed', cancelled: 'cancelled' }

export async function setWorkshopStatus(id: string, status: WorkshopStatus) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  if (!WORKSHOP_STATUSES.includes(status)) redirect('/workshops?error=Unknown%20status')
  const { error } = await admin.supabase.from('workshops').update({ status }).eq('id', id)
  await revalidateWorkshops(id)
  redirect(error ? `/workshops?error=${encodeURIComponent(error.message)}` : `/workshops?saved=${statusMessages[status]}`)
}

export async function deleteWorkshop(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data, error } = await admin.supabase.from('workshops').delete().eq('id', id).select('id, image_url')
  // Registrations reference the workshop (ON DELETE RESTRICT), so student details are never deleted by accident.
  if (error?.code === '23503') redirect(`/workshops/${id}?error=${encodeURIComponent('This workshop has registrations, so it cannot be deleted. Mark it as cancelled or completed instead.')}`)
  if (error) redirect(`/workshops/${id}?error=${encodeURIComponent(error.message)}`)
  await removeImage(admin, bucketPath(data?.[0]?.image_url) ?? undefined)
  await revalidateWorkshops()
  redirect(data?.length ? '/workshops?saved=deleted' : '/workshops?error=Workshop%20not%20found')
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

/** Changes a registration's status. `back` is the registrations list URL (with its filters) to return to. */
export async function setRegistrationStatus(id: string, back: string, formData: FormData) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const status = String(formData.get('status') ?? '') as RegistrationStatus
  const returnTo = back.startsWith('/workshops/registrations') ? back : '/workshops/registrations'
  const join = returnTo.includes('?') ? '&' : '?'
  if (!REGISTRATION_STATUSES.includes(status)) redirect(`${returnTo}${join}error=Unknown%20status`)
  const { data, error } = await admin.supabase.from('workshop_registrations').update({ status }).eq('id', id).select('id')
  // Seats left on the website depend on registration status.
  await revalidateWorkshops()
  redirect(error || !data?.length ? `${returnTo}${join}error=${encodeURIComponent(error?.message ?? 'Registration not found')}` : `${returnTo}${join}saved=registration-updated`)
}

export async function deleteRegistration(id: string, back: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const returnTo = back.startsWith('/workshops/registrations') ? back : '/workshops/registrations'
  const join = returnTo.includes('?') ? '&' : '?'
  const { error } = await admin.supabase.from('workshop_registrations').delete().eq('id', id)
  await revalidateWorkshops()
  redirect(error ? `${returnTo}${join}error=${encodeURIComponent(error.message)}` : `${returnTo}${join}saved=registration-deleted`)
}

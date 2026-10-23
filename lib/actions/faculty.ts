'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminForAction } from '../dal'
import { revalidatePublicSite } from '../revalidate-site'
import { facultySchema } from '../faculty'
import type { CourseFormState } from './courses'

const NOT_ADMIN = 'Your session has expired or you no longer have admin access. Please sign in again.'
const BUCKET_URL_MARKER = '/storage/v1/object/public/course-images/'

function readForm(formData: FormData) {
  return {
    name: formData.get('name') ?? '', role: formData.get('role') ?? '', department: formData.get('department') ?? '',
    section: formData.get('section') ?? 'trainer', experience: formData.get('experience') ?? '', bio: formData.get('bio') ?? '',
    specialities: String(formData.get('specialities') ?? '').split('\n').map((value) => value.trim()).filter(Boolean),
    image_url: formData.get('image_url') ?? '', image_alt: formData.get('image_alt') ?? '', sort_order: formData.get('sort_order') || 0,
    is_published: formData.get('is_published') === 'on',
  }
}

function snapshot(formData: FormData) {
  const values: Record<string, string> = {}
  for (const key of ['name', 'role', 'department', 'section', 'experience', 'bio', 'image_url', 'image_alt', 'sort_order', 'specialities']) values[key] = String(formData.get(key) ?? '')
  values.is_published = formData.get('is_published') === 'on' ? 'on' : ''
  return values
}

function validate(formData: FormData) {
  const parsed = facultySchema.safeParse(readForm(formData))
  if (parsed.success) return { data: parsed.data }
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
  return { state: { error: 'Please fix the highlighted fields.', fieldErrors, values: snapshot(formData) } satisfies CourseFormState }
}

function databaseError(error: { code?: string; message: string }): CourseFormState {
  if (error.code === 'PGRST205') return { error: 'The faculty table is not set up yet. Run supabase/migrations/006_faculty.sql in the Supabase SQL Editor, then try again.' }
  if (error.code === '42501') return { error: 'The database refused this change. Check that your account is in admin_users.' }
  return { error: `Could not save the faculty profile: ${error.message}` }
}

function bucketPath(imageUrl: string | null | undefined) {
  const index = imageUrl?.indexOf(BUCKET_URL_MARKER) ?? -1
  return imageUrl && index >= 0 ? decodeURIComponent(imageUrl.slice(index + BUCKET_URL_MARKER.length)) : null
}

async function uploadImage(admin: Awaited<ReturnType<typeof getAdminForAction>>, formData: FormData) {
  const file = formData.get('image_file')
  if (!file || typeof file === 'string' || typeof file !== 'object') return { url: null as string | null }
  const upload = file as File
  if (upload.size === 0) return { url: null as string | null }
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }
  const extension = extensions[upload.type]
  if (!extension) return { error: 'Upload a JPG, PNG, WebP or AVIF image.' }
  if (upload.size > 5 * 1024 * 1024) return { error: 'Image must be 5 MB or smaller.' }
  if (!admin) return { error: NOT_ADMIN }
  const path = `${admin.userId}/faculty-${crypto.randomUUID()}.${extension}`
  const { error } = await admin.supabase.storage.from('course-images').upload(path, upload, { contentType: upload.type, cacheControl: '31536000', upsert: false })
  if (error) return { error: `Could not upload image: ${error.message}` }
  return { url: admin.supabase.storage.from('course-images').getPublicUrl(path).data.publicUrl, path }
}

async function removeImage(admin: Awaited<ReturnType<typeof getAdminForAction>>, path?: string) {
  if (admin && path) await admin.supabase.storage.from('course-images').remove([path])
}

// Display order is a position within the profile's section (1 = first among the heads, trainers…).
// Placing a profile renumbers its section 1..n, so the number always matches the order on the website.
// Position 0 (field left empty) puts the profile at the end of its section.
async function placeFaculty(admin: NonNullable<Awaited<ReturnType<typeof getAdminForAction>>>, id: string, section: string, position: number) {
  const { data, error } = await admin.supabase.from('faculty').select('id, sort_order').eq('section', section).order('sort_order').order('name')
  if (error || !data) return
  const ordered = data.filter((member) => member.id !== id)
  const index = position > 0 ? Math.min(position, ordered.length + 1) - 1 : ordered.length
  // An empty id only renumbers the section (used after a profile leaves it).
  if (id) ordered.splice(index, 0, { id, sort_order: -1 })
  await Promise.all(ordered.flatMap((member, i) => member.sort_order === i + 1 ? [] : [admin.supabase.from('faculty').update({ sort_order: i + 1 }).eq('id', member.id)]))
}

export async function createFaculty(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const uploaded = await uploadImage(admin, formData)
  if (uploaded.error) return { error: uploaded.error, values: snapshot(formData) }
  if (uploaded.url) formData.set('image_url', uploaded.url)
  const result = validate(formData)
  if (!result.data) { await removeImage(admin, uploaded.path); return result.state }
  const { data, error } = await admin.supabase.from('faculty').insert(result.data).select('id').single()
  if (error) { await removeImage(admin, uploaded.path); return { ...databaseError(error), values: snapshot(formData) } }
  await placeFaculty(admin, data.id, result.data.section, result.data.sort_order)
  revalidatePath('/faculty', 'page')
  await revalidatePublicSite()
  redirect(`/faculty/${data.id}?saved=created`)
}

export async function updateFaculty(id: string, _prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const uploaded = await uploadImage(admin, formData)
  if (uploaded.error) return { error: uploaded.error, values: snapshot(formData) }
  if (uploaded.url) formData.set('image_url', uploaded.url)
  const result = validate(formData)
  if (!result.data) { await removeImage(admin, uploaded.path); return result.state }
  const { data: before } = await admin.supabase.from('faculty').select('image_url, section').eq('id', id).maybeSingle()
  const { data, error } = await admin.supabase.from('faculty').update(result.data).eq('id', id).select('id')
  if (error || !data?.length) { await removeImage(admin, uploaded.path); return { ...(error ? databaseError(error) : { error: 'Faculty profile not found.' }), values: snapshot(formData) } }
  const oldPath = bucketPath(before?.image_url)
  if (oldPath && before?.image_url !== result.data.image_url) await removeImage(admin, oldPath)
  await placeFaculty(admin, id, result.data.section, result.data.sort_order)
  // Moved to another section: close the gap it left behind.
  if (before?.section && before.section !== result.data.section) await placeFaculty(admin, '', before.section, 0)
  revalidatePath('/faculty', 'page')
  await revalidatePublicSite()
  redirect(`/faculty/${id}?saved=updated`)
}

export async function setFacultyPublished(id: string, publish: boolean) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { error } = await admin.supabase.from('faculty').update({ is_published: publish }).eq('id', id)
  revalidatePath('/faculty', 'page')
  await revalidatePublicSite()
  redirect(error ? `/faculty?error=${encodeURIComponent(error.message)}` : `/faculty?saved=${publish ? 'published' : 'unpublished'}`)
}

export async function deleteFaculty(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data, error } = await admin.supabase.from('faculty').delete().eq('id', id).select('id, image_url')
  if (error) redirect(`/faculty/${id}?error=${encodeURIComponent(error.message)}`)
  await removeImage(admin, bucketPath(data?.[0]?.image_url) ?? undefined)
  revalidatePath('/faculty', 'page')
  await revalidatePublicSite()
  redirect(data?.length ? '/faculty?saved=deleted' : '/faculty?error=Faculty%20profile%20not%20found')
}

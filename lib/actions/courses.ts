'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminForAction } from '../dal'
import { revalidatePublicSite } from '../revalidate-site'
import { courseSchema } from '../courses'

// `values` echoes the submitted fields back: React resets uncontrolled inputs after an action,
// so the form uses them as defaults to keep what the admin typed when saving fails.
export type CourseFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }

const NOT_ADMIN = 'Your session has expired or you no longer have admin access. Please sign in again.'

function readForm(formData: FormData) {
  let curriculum: unknown = []
  try {
    curriculum = JSON.parse(String(formData.get('curriculum') ?? '[]'))
  } catch {
    curriculum = null
  }
  return {
    title: formData.get('title') ?? '',
    slug: formData.get('slug') ?? '',
    category: formData.get('category') ?? '',
    description: formData.get('description') ?? '',
    duration: formData.get('duration') ?? '',
    image_url: formData.get('image_url') ?? '',
    image_alt: formData.get('image_alt') ?? '',
    curriculum,
    sort_order: formData.get('sort_order') || 0,
    is_published: formData.get('is_published') === 'on',
  }
}

function snapshot(formData: FormData) {
  const values: Record<string, string> = {}
  for (const key of ['title', 'slug', 'category', 'description', 'duration', 'image_url', 'image_alt', 'sort_order', 'curriculum']) values[key] = String(formData.get(key) ?? '')
  values.is_published = formData.get('is_published') === 'on' ? 'on' : ''
  return values
}

function validate(formData: FormData) {
  const parsed = courseSchema.safeParse(readForm(formData))
  if (parsed.success) return { data: parsed.data }
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    fieldErrors[key] ??= issue.message
  }
  return { state: { error: 'Please fix the highlighted fields.', fieldErrors, values: snapshot(formData) } satisfies CourseFormState }
}

function databaseError(error: { code?: string; message: string }): CourseFormState {
  if (error.code === '23505') return { error: 'Another course already uses this slug.', fieldErrors: { slug: 'This slug is already taken. Slugs must be unique.' } }
  if (error.code === '42501') return { error: 'The database refused this change (admin permission missing). Check that your account is in admin_users.' }
  if (error.code === '23514') return { error: 'A value does not meet the database rules (check slug, image path and lengths).' }
  return { error: `Could not save the course: ${error.message}` }
}

const IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }
const BUCKET_URL_MARKER = '/storage/v1/object/public/course-images/'

// Storage path of an image uploaded to the course-images bucket, or null for /public paths and other URLs.
function bucketPath(imageUrl: string | null | undefined) {
  const index = imageUrl?.indexOf(BUCKET_URL_MARKER) ?? -1
  return imageUrl && index >= 0 ? decodeURIComponent(imageUrl.slice(index + BUCKET_URL_MARKER.length)) : null
}

async function uploadCourseImage(admin: Awaited<ReturnType<typeof getAdminForAction>>, formData: FormData) {
  const file = formData.get('image_file')
  if (!file || typeof file === 'string' || typeof file !== 'object') return { url: null as string | null }
  const upload = file as File
  if (upload.size === 0) return { url: null as string | null }
  const extension = IMAGE_EXTENSIONS[upload.type]
  if (!extension) {
    return { error: 'Upload a JPG, PNG, WebP or AVIF image.' }
  }
  if (upload.size > 5 * 1024 * 1024) return { error: 'Image must be 5 MB or smaller.' }
  if (!admin) return { error: NOT_ADMIN }

  const path = `${admin.userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await admin.supabase.storage.from('course-images').upload(path, upload, {
    contentType: upload.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { error: `Could not upload image: ${error.message}` }
  return { url: admin.supabase.storage.from('course-images').getPublicUrl(path).data.publicUrl, path }
}

async function removeUploadedImage(admin: Awaited<ReturnType<typeof getAdminForAction>>, path?: string) {
  if (admin && path) await admin.supabase.storage.from('course-images').remove([path])
}

// Display order is a position (1 = first). Placing a course renumbers every course 1..n, so the
// number the admin types always matches where the course appears on the website.
// Position 0 (field left empty) puts the course at the end.
async function placeCourse(admin: NonNullable<Awaited<ReturnType<typeof getAdminForAction>>>, id: string, position: number) {
  const { data, error } = await admin.supabase.from('courses').select('id, sort_order').order('sort_order').order('title')
  if (error || !data) return
  const ordered = data.filter((course) => course.id !== id)
  const index = position > 0 ? Math.min(position, ordered.length + 1) - 1 : ordered.length
  ordered.splice(index, 0, { id, sort_order: -1 })
  await Promise.all(ordered.flatMap((course, i) => course.sort_order === i + 1 ? [] : [admin.supabase.from('courses').update({ sort_order: i + 1 }).eq('id', course.id)]))
}

export async function createCourse(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const uploaded = await uploadCourseImage(admin, formData)
  if (uploaded.error) return { error: uploaded.error, values: snapshot(formData) }
  if (uploaded.url) formData.set('image_url', uploaded.url)
  const result = validate(formData)
  if (!result.data) {
    await removeUploadedImage(admin, uploaded.path)
    return result.state
  }

  const { data, error } = await admin.supabase.from('courses').insert(result.data).select('id').single()
  if (error) {
    await removeUploadedImage(admin, uploaded.path)
    return { ...databaseError(error), values: snapshot(formData) }
  }
  await placeCourse(admin, data.id, result.data.sort_order)

  revalidatePath('/courses')
  revalidatePath('/')
  await revalidatePublicSite()
  redirect(`/courses/${data.id}?saved=created`)
}

export async function updateCourse(id: string, _prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const uploaded = await uploadCourseImage(admin, formData)
  if (uploaded.error) return { error: uploaded.error, values: snapshot(formData) }
  if (uploaded.url) formData.set('image_url', uploaded.url)
  const result = validate(formData)
  if (!result.data) {
    await removeUploadedImage(admin, uploaded.path)
    return result.state
  }

  const { data: before } = await admin.supabase.from('courses').select('image_url').eq('id', id).maybeSingle()
  const { data, error } = await admin.supabase.from('courses').update(result.data).eq('id', id).select('id')
  if (error) {
    await removeUploadedImage(admin, uploaded.path)
    return { ...databaseError(error), values: snapshot(formData) }
  }
  if (!data || data.length === 0) {
    await removeUploadedImage(admin, uploaded.path)
    return { error: 'This course no longer exists, or you do not have permission to edit it.', values: snapshot(formData) }
  }

  // The image was replaced: delete the previous upload so unused files don't pile up.
  const previousPath = bucketPath(before?.image_url)
  if (previousPath && before?.image_url !== result.data.image_url) await removeUploadedImage(admin, previousPath)
  await placeCourse(admin, id, result.data.sort_order)

  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
  revalidatePath('/')
  await revalidatePublicSite()
  redirect(`/courses/${id}?saved=updated`)
}

export async function setCoursePublished(id: string, publish: boolean) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { error } = await admin.supabase.from('courses').update({ is_published: publish }).eq('id', id)
  revalidatePath('/courses')
  revalidatePath(`/courses/${id}`)
  revalidatePath('/')
  await revalidatePublicSite()
  redirect(error ? `/courses?error=${encodeURIComponent(error.message)}` : `/courses?saved=${publish ? 'published' : 'unpublished'}`)
}

export async function deleteCourse(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data, error } = await admin.supabase.from('courses').delete().eq('id', id).select('id, image_url')
  revalidatePath('/courses')
  revalidatePath('/')
  await revalidatePublicSite()
  if (error) redirect(`/courses/${id}?error=${encodeURIComponent(error.message)}`)
  // Remove the course's uploaded image too (images in the website's /public folder are untouched).
  const uploadedPath = bucketPath(data?.[0]?.image_url)
  if (uploadedPath) await removeUploadedImage(admin, uploadedPath)
  redirect(data && data.length > 0 ? '/courses?saved=deleted' : '/courses?error=Course%20not%20found%20or%20not%20permitted')
}

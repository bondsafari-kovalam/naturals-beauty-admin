'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminForAction, type AdminSession } from '../dal'
import { revalidatePublicSite } from '../revalidate-site'
import { blogCategorySchema, blogPostSchema, fromIstInput, slugify, type BlogIntent, type BlogPostRow } from '../blog'
import { htmlToText, sanitizeBlogHtml } from '../blog-html'
import type { CourseFormState } from './courses'

const NOT_ADMIN = 'Your session has expired or you no longer have admin access. Please sign in again.'
const MISSING_TABLE = 'The blog tables are not set up yet. Run supabase/migrations/009_blog.sql in the Supabase SQL Editor, then try again.'
const BUCKET = 'course-images'
const BUCKET_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }
const FORM_KEYS = ['title', 'slug', 'excerpt', 'category_id', 'tags', 'author_name', 'featured_image', 'image_alt', 'image_caption', 'content', 'published_at', 'last_reviewed_at']

// ---------------------------------------------------------------------------
// Images (cover, social and in-article images) go to the existing public course-images bucket under blog/.
// ---------------------------------------------------------------------------

export type UploadResult = { url?: string; error?: string }

export async function uploadBlogImage(formData: FormData): Promise<UploadResult> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const file = formData.get('file')
  if (!file || typeof file === 'string') return { error: 'Choose an image to upload.' }
  const extension = IMAGE_EXTENSIONS[file.type]
  if (!extension) return { error: 'Upload a JPG, PNG, WebP or AVIF image.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Image must be 5 MB or smaller.' }
  const path = `blog/${admin.userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await admin.supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) return { error: `Could not upload image: ${error.message}` }
  return { url: admin.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

function bucketPath(url: string | null | undefined) {
  const index = url?.indexOf(BUCKET_URL_MARKER) ?? -1
  return url && index >= 0 ? decodeURIComponent(url.slice(index + BUCKET_URL_MARKER.length).split('?')[0]) : null
}

/** Every uploaded image a post references: cover, social image and images inside the article. */
function postImagePaths(post: Pick<BlogPostRow, 'featured_image' | 'social_image' | 'content'>) {
  const inline = [...post.content.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1].replace(/&amp;/g, '&'))
  return [...new Set([post.featured_image, post.social_image, ...inline].map(bucketPath).filter((path): path is string => Boolean(path)))]
}

async function removeImages(admin: AdminSession, paths: string[]) {
  if (paths.length) await admin.supabase.storage.from(BUCKET).remove(paths)
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

function snapshot(formData: FormData) {
  const values: Record<string, string> = {}
  for (const key of FORM_KEYS) values[key] = String(formData.get(key) ?? '')
  values.is_featured = formData.get('is_featured') === 'on' ? 'on' : ''
  return values
}

function parseTags(value: FormDataEntryValue | null) {
  return [...new Map(String(value ?? '').split(',').map((tag) => tag.trim().replace(/\s+/g, ' ')).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()]
}

type Validated = { data: Record<string, unknown>; intent: BlogIntent } | { state: CourseFormState }

/** Validates the form and works out status + published_at from the button that was pressed. */
function validate(formData: FormData, existing: Pick<BlogPostRow, 'status' | 'published_at'> | null): Validated {
  const fail = (fieldErrors: Record<string, string>, error = 'Please fix the highlighted fields.') => ({ state: { error, fieldErrors, values: snapshot(formData) } })
  const parsed = blogPostSchema.safeParse({
    title: formData.get('title') ?? '', slug: formData.get('slug') ?? '', excerpt: formData.get('excerpt') ?? '',
    category_id: formData.get('category_id') ?? '', tags: parseTags(formData.get('tags')), author_name: formData.get('author_name') ?? '',
    is_featured: formData.get('is_featured') === 'on', featured_image: formData.get('featured_image') ?? '', image_alt: formData.get('image_alt') ?? '',
    image_caption: formData.get('image_caption') ?? '', content: formData.get('content') ?? '', published_at: formData.get('published_at') ?? '', last_reviewed_at: formData.get('last_reviewed_at') ?? '',
    intent: formData.get('intent') ?? 'draft',
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    return fail(fieldErrors)
  }

  const { intent, published_at: publishInput, content: rawContent, ...fields } = parsed.data
  const content = sanitizeBlogHtml(rawContent)
  const chosenDate = publishInput ? fromIstInput(publishInput) : null
  if (publishInput && !chosenDate) return fail({ published_at: 'Choose a valid date and time.' })
  const now = Date.now()
  const isFuture = chosenDate !== null && new Date(chosenDate).getTime() > now

  let status: BlogPostRow['status']
  let publishedAt: string | null
  if (intent === 'draft') {
    status = 'draft'
    publishedAt = chosenDate
  } else if (intent === 'schedule') {
    if (!isFuture) return fail({ published_at: 'Choose a date and time in the future to schedule this post.' })
    status = 'scheduled'
    publishedAt = chosenDate
  } else if (intent === 'publish') {
    // Publish now: keep a past date (e.g. an imported or previously published article), otherwise now.
    status = 'published'
    publishedAt = chosenDate && !isFuture ? chosenDate : new Date(now).toISOString()
  } else {
    // Save changes to a post that is already published or scheduled, keeping its status.
    status = existing?.status ?? 'draft'
    publishedAt = chosenDate ?? existing?.published_at ?? null
    if (status === 'scheduled' && !isFuture) status = 'published'
    if (status !== 'draft' && !publishedAt) publishedAt = new Date(now).toISOString()
  }

  if (status !== 'draft' && !htmlToText(content) && !content.includes('<img') && !content.includes('<iframe')) {
    return fail({ content: 'Write the article before publishing it.' })
  }

  return { intent, data: { ...fields, content, status, published_at: publishedAt } }
}

function databaseError(error: { code?: string; message: string }): CourseFormState {
  if (error.code === 'PGRST205') return { error: MISSING_TABLE }
  if (error.code === '23505') return { error: 'Another post already uses this slug.', fieldErrors: { slug: 'This slug is already taken. Slugs must be unique.' } }
  if (error.code === '23503') return { error: 'The chosen category no longer exists.', fieldErrors: { category_id: 'Choose another category.' } }
  if (error.code === '42501') return { error: 'The database refused this change. Check that your account is in admin_users.' }
  if (error.code === '23514') return { error: 'A value does not meet the database rules (check slug, image links, dates and lengths).' }
  return { error: `Could not save the post: ${error.message}` }
}

async function revalidateBlog(id?: string) {
  revalidatePath('/blog', 'layout')
  if (id) revalidatePath(`/blog/${id}`)
  await revalidatePublicSite()
}

const savedKey = (status: BlogPostRow['status'], intent: BlogIntent) => intent === 'update' ? 'updated' : status === 'draft' ? 'draft' : status

export async function createBlogPost(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const result = validate(formData, null)
  if ('state' in result) return result.state
  const { data, error } = await admin.supabase.from('blog_posts').insert(result.data).select('id, status').single()
  if (error) return { ...databaseError(error), values: snapshot(formData) }
  await revalidateBlog()
  redirect(`/blog/${data.id}?saved=${savedKey(data.status, result.intent)}`)
}

export async function updateBlogPost(id: string, _prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const { data: before, error: readError } = await admin.supabase.from('blog_posts').select('status, published_at, featured_image, social_image, content').eq('id', id).maybeSingle()
  if (readError) return { ...databaseError(readError), values: snapshot(formData) }
  if (!before) return { error: 'This post no longer exists, or you do not have permission to edit it.', values: snapshot(formData) }
  const result = validate(formData, before)
  if ('state' in result) return result.state
  const { data, error } = await admin.supabase.from('blog_posts').update(result.data).eq('id', id).select('id, status, featured_image, social_image, content')
  if (error) return { ...databaseError(error), values: snapshot(formData) }
  if (!data?.length) return { error: 'This post no longer exists, or you do not have permission to edit it.', values: snapshot(formData) }

  // Images that were replaced or removed from the article: delete the uploads so they don't pile up.
  const kept = new Set(postImagePaths(data[0]))
  await removeImages(admin, postImagePaths(before).filter((path) => !kept.has(path)))
  await revalidateBlog(id)
  redirect(`/blog/${id}?saved=${savedKey(data[0].status, result.intent)}`)
}

export async function setBlogPostPublished(id: string, publish: boolean) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data: post } = await admin.supabase.from('blog_posts').select('published_at, content').eq('id', id).maybeSingle()
  if (!post) redirect('/blog?error=Post%20not%20found%20or%20not%20permitted')
  if (publish && !htmlToText(post.content) && !post.content.includes('<img')) redirect(`/blog/${id}?error=${encodeURIComponent('Write the article before publishing it.')}`)
  // Publishing keeps an earlier publication date (re-publishing after an unpublish); a future date means "now".
  const keepDate = post.published_at && new Date(post.published_at).getTime() <= Date.now()
  const change = publish ? { status: 'published', published_at: keepDate ? post.published_at : new Date().toISOString() } : { status: 'draft' }
  const { error } = await admin.supabase.from('blog_posts').update(change).eq('id', id)
  await revalidateBlog(id)
  redirect(error ? `/blog?error=${encodeURIComponent(error.message)}` : `/blog?saved=${publish ? 'published' : 'unpublished'}`)
}

export async function deleteBlogPost(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data, error } = await admin.supabase.from('blog_posts').delete().eq('id', id).select('featured_image, social_image, content')
  if (error) redirect(`/blog/${id}?error=${encodeURIComponent(error.message)}`)
  if (data?.[0]) await removeImages(admin, postImagePaths(data[0]))
  await revalidateBlog()
  redirect(data?.length ? '/blog?saved=deleted' : '/blog?error=Post%20not%20found%20or%20not%20permitted')
}

export type SlugCheck = { available: boolean; message: string }

export async function checkBlogSlug(slug: string, excludeId?: string): Promise<SlugCheck> {
  const admin = await getAdminForAction()
  if (!admin) return { available: false, message: NOT_ADMIN }
  const clean = slugify(slug)
  if (!clean || clean !== slug) return { available: false, message: 'Use lowercase letters, numbers and single hyphens only.' }
  let query = admin.supabase.from('blog_posts').select('id').eq('slug', clean).limit(1)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) return { available: false, message: error.code === 'PGRST205' ? MISSING_TABLE : `Could not check the slug: ${error.message}` }
  return data.length ? { available: false, message: 'Another post already uses this slug.' } : { available: true, message: 'This address is available.' }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createBlogCategory(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const values = { name: String(formData.get('name') ?? '') }
  const parsed = blogCategorySchema.safeParse(values)
  if (!parsed.success) return { error: 'Please fix the highlighted field.', fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Enter a category name.' }, values }
  const slug = slugify(parsed.data.name)
  if (!slug) return { error: 'Please fix the highlighted field.', fieldErrors: { name: 'Use at least one letter or number.' }, values }

  const { data: last, error: readError } = await admin.supabase.from('blog_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  if (readError) return { error: readError.code === 'PGRST205' ? MISSING_TABLE : readError.message, values }
  const { error } = await admin.supabase.from('blog_categories').insert({ name: parsed.data.name, slug, sort_order: (last?.sort_order ?? 0) + 1 })
  if (error) return { ...(error.code === '23505' ? { error: 'This category already exists.', fieldErrors: { name: 'A category with this name already exists.' } } : { error: `Could not save the category: ${error.message}` }), values }

  await revalidateBlog()
  redirect('/blog/categories?saved=category-created')
}

export async function deleteBlogCategory(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data: category } = await admin.supabase.from('blog_categories').select('name').eq('id', id).maybeSingle()
  if (!category) redirect('/blog/categories?error=Category%20not%20found%20or%20not%20permitted')
  const { count } = await admin.supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if (count) redirect(`/blog/categories?error=${encodeURIComponent(`“${category.name}” is used by ${count} post${count === 1 ? '' : 's'}. Move ${count === 1 ? 'it' : 'them'} to another category first.`)}`)
  const { error } = await admin.supabase.from('blog_categories').delete().eq('id', id)
  await revalidateBlog()
  redirect(error ? `/blog/categories?error=${encodeURIComponent(error.message)}` : '/blog/categories?saved=category-deleted')
}

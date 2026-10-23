import { z } from 'zod'

// Mirrors public.blog_posts / public.blog_categories (supabase/migrations/009_blog.sql in the website project).
export type BlogStatus = 'draft' | 'published' | 'scheduled'
export type BlogCategoryRow = { id: string; name: string; slug: string; sort_order: number; created_at: string }
export type BlogPostRow = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image: string | null
  image_alt: string | null
  image_caption: string | null
  category_id: string
  tags: string[]
  author_name: string | null
  author_id: string | null
  seo_title: string | null
  meta_description: string | null
  focus_keyword: string | null
  canonical_url: string | null
  social_image: string | null
  status: BlogStatus
  is_featured: boolean
  published_at: string | null
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
}

export const DEFAULT_AUTHOR = 'Naturals Beauty Academy'

/** What visitors actually see: a scheduled post whose time has passed is live. */
export function effectiveStatus(post: Pick<BlogPostRow, 'status' | 'published_at'>, now = Date.now()): 'draft' | 'published' | 'scheduled' {
  if (post.status === 'draft') return 'draft'
  return post.published_at && new Date(post.published_at).getTime() <= now ? 'published' : 'scheduled'
}

export const statusTone = { draft: 'warning', published: 'success', scheduled: 'brand' } as const

const IST = 'Asia/Kolkata'

export function formatDate(value: string | null, withTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short', timeZone: IST } : { dateStyle: 'medium', timeZone: IST }).format(new Date(value))
}

/** ISO timestamp → value for <input type="datetime-local">, in India time (the academy's time zone). */
export function toIstInput(value: string | null) {
  if (!value) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** <input type="datetime-local"> value, read as India time → ISO timestamp. */
export function fromIstInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value}:00+05:30`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).transform((value) => value || null)
const optionalImage = z.string().trim().transform((value) => value || null)
  .refine((value) => value === null || /^(\/|https:\/\/)/.test(value), 'Use an uploaded image, a path starting with /, or an https:// link.')

export const blogIntents = ['draft', 'publish', 'schedule', 'update'] as const
export type BlogIntent = (typeof blogIntents)[number]

// Same limits as the database CHECK constraints, so errors show next to the field instead of failing on save.
export const blogPostSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  slug: z.string().trim().toLowerCase().min(1, 'Enter a slug.').max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only (e.g. summer-skincare-routine).'),
  excerpt: z.string().trim().min(1, 'Enter a short description.').max(500, 'Keep this under 500 characters.'),
  category_id: z.string().uuid('Choose a category.'),
  tags: z.array(z.string().trim().min(1).max(40, 'Keep each tag under 40 characters.')).max(20, 'Use 20 tags or fewer.'),
  author_name: optionalText(120),
  is_featured: z.boolean(),
  featured_image: optionalImage,
  image_alt: optionalText(300),
  image_caption: optionalText(300),
  content: z.string().max(200000, 'The article is too long.'),
  published_at: z.string().trim(),
  last_reviewed_at: z.string().trim().transform((value) => value || null)
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid date.'),
  intent: z.enum(blogIntents),
}).superRefine((value, ctx) => {
  if (value.featured_image && !value.image_alt) ctx.addIssue({ code: 'custom', path: ['image_alt'], message: 'Describe the image for screen readers and search engines.' })
})

export const blogCategorySchema = z.object({
  name: z.string().trim().min(1, 'Enter a category name.').max(100, 'Keep this under 100 characters.').transform((value) => value.replace(/\s+/g, ' ')),
})

export function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120).replace(/-$/, '')
}

/** Absolute URL for an image stored as a website path (/foo.jpg) or a full https:// link. */
export function imageSrc(value: string | null | undefined, publicSiteUrl: string) {
  if (!value) return ''
  return value.startsWith('/') ? `${publicSiteUrl}${value}` : value
}

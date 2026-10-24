import { z } from 'zod'
import { PAGE_LINK_MESSAGE, isPageLink } from './image-url'

// Mirrors public.courses (supabase/migrations/002_courses.sql in naturals-beauty-web).
export type CourseModule = { heading: string; topics: string[]; note?: string }
export type CourseRow = {
  id: string
  slug: string
  title: string
  category: string
  description: string
  duration: string | null
  image_url: string
  image_alt: string | null
  curriculum: CourseModule[]
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

// The original categories, seeded into public.course_categories by 008_course_categories.sql.
// Only used as a fallback list until that migration has been run; manage categories on /categories.
export const KNOWN_CATEGORIES = [
  'Beauty Therapy',
  'Hair Dressing',
  'Makeup Artistry',
  'Nail Art & Extensions',
  'Cosmetology',
  'Beauty Therapy & Hair Dressing',
  'Hair Styling',
  'Personal Grooming',
  'Mehandi',
]

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).transform((value) => value || null)

const moduleSchema = z.object({
  heading: z.string().trim().min(1, 'Every module needs a heading.').max(200),
  topics: z.array(z.string().trim().min(1).max(300)).max(100),
  note: z.string().trim().max(500).optional(),
})

// Same rules as the database CHECK constraints, so errors show next to the field instead of failing on save.
export const courseSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  slug: z.string().trim().toLowerCase().min(1, 'Enter a slug.').max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only (e.g. foundation-course-beauty-therapy).'),
  category: z.string().trim().min(1, 'Choose a category.').max(100),
  description: z.string().trim().min(1, 'Enter a description.').max(2000),
  duration: optionalText(60),
  image_url: z.string().trim().min(1, 'Enter an image path or URL.').regex(/^(\/|https:\/\/)/, 'Use a path starting with / (an image in the website’s public folder) or an https:// link.')
    .refine((value) => !isPageLink(value), PAGE_LINK_MESSAGE),
  image_alt: optionalText(300),
  curriculum: z.array(moduleSchema).max(60),
  sort_order: z.coerce.number().int('Use a whole number.').min(0).max(100000),
  is_published: z.boolean(),
})

export type CourseInput = z.infer<typeof courseSchema>

export function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

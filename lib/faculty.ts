import { z } from 'zod'
import { PAGE_LINK_MESSAGE, isPageLink } from './image-url'

export const FACULTY_SECTIONS = ['director', 'head', 'trainer'] as const
// Labels shown to admins. The stored value stays 'head' (the website filters on it).
export const FACULTY_SECTION_LABELS: Record<(typeof FACULTY_SECTIONS)[number], string> = { director: 'Academy head', head: 'Senior faculty', trainer: 'Trainer' }
export type FacultySection = (typeof FACULTY_SECTIONS)[number]

export type FacultyRow = {
  id: string
  name: string
  role: string
  department: string
  section: FacultySection
  experience: string | null
  bio: string | null
  specialities: string[]
  image_url: string
  image_alt: string | null
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null)

export const facultySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(200),
  role: z.string().trim().min(1, 'Enter a role.').max(200),
  department: z.string().trim().min(1, 'Enter a department.').max(120),
  section: z.enum(FACULTY_SECTIONS),
  experience: optionalText(100),
  bio: optionalText(2000),
  specialities: z.array(z.string().trim().min(1).max(120)).max(20),
  image_url: z.string().trim().min(1, 'Enter an image path or URL.').regex(/^(\/|https:\/\/)/, 'Use a / path or an https:// URL.').refine((value) => !isPageLink(value), PAGE_LINK_MESSAGE),
  image_alt: optionalText(300),
  sort_order: z.coerce.number().int().min(0).max(100000),
  is_published: z.boolean(),
})

export type FacultyInput = z.infer<typeof facultySchema>

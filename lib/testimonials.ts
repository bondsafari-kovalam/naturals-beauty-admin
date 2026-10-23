import { z } from 'zod'

// Mirrors public.testimonials (supabase/migrations/011_testimonials.sql in the website project).
export type TestimonialRow = {
  id: string
  name: string
  course: string | null
  location: string | null
  quote: string
  rating: number
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).transform((value) => value || null)

// Same rules as the database CHECK constraints, so errors show next to the field instead of failing on save.
export const testimonialSchema = z.object({
  name: z.string().trim().min(1, 'Enter the student’s name.').max(120),
  course: optionalText(200),
  location: optionalText(120),
  quote: z.string().trim().min(1, 'Enter what the student said.').max(1000, 'Keep the testimonial under 1000 characters.'),
  rating: z.coerce.number().int().min(1, 'Choose a rating from 1 to 5.').max(5, 'Choose a rating from 1 to 5.'),
  sort_order: z.coerce.number().int('Use a whole number.').min(0).max(100000),
  is_published: z.boolean(),
})

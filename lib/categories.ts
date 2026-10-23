import { z } from 'zod'
import type { AdminSession } from './dal'
import { KNOWN_CATEGORIES } from './courses'

// Mirrors public.course_categories (supabase/migrations/008_course_categories.sql in the website project).
export type CategoryRow = { id: string; name: string; sort_order: number; created_at: string }

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter a category name.').max(100, 'Keep this under 100 characters.').transform((value) => value.replace(/\s+/g, ' ')),
})

/**
 * Category names for pickers and filters, in display order. Falls back to the built-in list
 * until 008_course_categories.sql has been run, so the course form keeps working.
 */
export async function loadCategoryNames(supabase: AdminSession['supabase']) {
  const { data, error } = await supabase.from('course_categories').select('name').order('sort_order').order('name')
  if (error || !data) return [...KNOWN_CATEGORIES]
  return data.map((row) => row.name as string)
}

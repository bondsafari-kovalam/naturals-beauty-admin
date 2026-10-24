'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAdminForAction } from '../dal'
import { revalidatePublicSite } from '../revalidate-site'
import { categorySchema } from '../categories'
import type { CourseFormState } from './courses'

const NOT_ADMIN = 'Your session has expired or you no longer have admin access. Please sign in again.'

function databaseError(error: { code?: string; message: string }): CourseFormState {
  if (error.code === 'PGRST205') return { error: 'The categories table is not set up yet. Run supabase/migrations/008_course_categories.sql in the Supabase SQL Editor, then try again.' }
  if (error.code === '23505') return { error: 'This category already exists.', fieldErrors: { name: 'A category with this name already exists.' } }
  if (error.code === '42501') return { error: 'The database refused this change. Check that your account is in admin_users.' }
  return { error: `Could not save the category: ${error.message}` }
}

function revalidateCategoryPages() {
  revalidatePath('/categories')
  revalidatePath('/courses', 'layout')
}

export async function createCategory(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const admin = await getAdminForAction()
  if (!admin) return { error: NOT_ADMIN }
  const values = { name: String(formData.get('name') ?? '') }
  const parsed = categorySchema.safeParse(values)
  if (!parsed.success) return { error: 'Please fix the highlighted field.', fieldErrors: { name: parsed.error.issues[0]?.message ?? 'Enter a category name.' }, values }

  // New categories go to the end of the list.
  const { data: last, error: readError } = await admin.supabase.from('course_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  if (readError) return { ...databaseError(readError), values }
  const { error } = await admin.supabase.from('course_categories').insert({ name: parsed.data.name, sort_order: (last?.sort_order ?? 0) + 1 })
  if (error) return { ...databaseError(error), values }

  revalidateCategoryPages()
  redirect('/categories?saved=created')
}

export async function deleteCategory(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data: category } = await admin.supabase.from('course_categories').select('name').eq('id', id).maybeSingle()
  if (!category) redirect('/categories?error=Category%20not%20found%20or%20not%20permitted')

  // Courses store the category name, so deleting one that is still in use would orphan those courses.
  // GET with limit(0) instead of HEAD: HEAD responses hide errors, which would skip this check.
  const { count, error: countError } = await admin.supabase.from('courses').select('id', { count: 'exact' }).limit(0).eq('category', category.name)
  if (countError) redirect(`/categories?error=${encodeURIComponent(`Could not check which courses use this category: ${countError.message}`)}`)
  if (count) redirect(`/categories?error=${encodeURIComponent(`“${category.name}” is used by ${count} course${count === 1 ? '' : 's'}. Move ${count === 1 ? 'it' : 'them'} to another category first.`)}`)

  // select() returns the deleted rows: Row Level Security can silently delete nothing without an error.
  const { data: deleted, error } = await admin.supabase.from('course_categories').delete().eq('id', id).select('id')
  revalidateCategoryPages()
  if (error) {
    console.error(`Category delete failed (${error.code}): ${error.message}`)
    redirect(`/categories?error=${encodeURIComponent(error.message)}`)
  }
  if (!deleted?.length) {
    console.error(`Category delete removed no rows for ${id}: the database did not allow it (check admin_users and the course_categories policies).`)
    redirect(`/categories?error=${encodeURIComponent('The database did not delete this category. Your account may not have permission. Ask the owner to check admin_users in Supabase.')}`)
  }
  await revalidatePublicSite()
  redirect('/categories?saved=deleted')
}

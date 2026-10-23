import 'server-only'
import type { AdminSession } from '@/lib/dal'

/** Categories for the post form, plus every tag already used (offered as suggestions). */
export async function loadBlogFormData(supabase: AdminSession['supabase']) {
  const [categories, tagRows] = await Promise.all([
    supabase.from('blog_categories').select('id, name').order('sort_order').order('name'),
    supabase.from('blog_posts').select('tags'),
  ])
  const tags = [...new Set((tagRows.data ?? []).flatMap((row) => (row.tags ?? []) as string[]))].sort((a, b) => a.localeCompare(b))
  return { categories: categories.data ?? [], categoriesError: categories.error, knownTags: tags }
}

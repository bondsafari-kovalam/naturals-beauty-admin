import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { createBlogPost } from '@/lib/actions/blog'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, PageHeader } from '@/components/ui'
import { BlogForm } from '../blog-form'
import { loadBlogFormData } from '../load-form-data'

export const metadata: Metadata = { title: 'New blog post' }

export default async function NewBlogPostPage() {
  const { supabase } = await requireAdmin()
  const { categories, categoriesError, knownTags } = await loadBlogFormData(supabase)
  return (
    <>
      <Link href="/blog" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All posts</Link>
      <PageHeader title="New blog post" description="Save as a draft while you work. Nothing appears on the website until you publish or schedule it." />
      {categoriesError && <div className="mb-4"><Alert tone="error">Could not load categories: {categoriesError.message}{categoriesError.code === 'PGRST205' ? ' — run 009_blog.sql in Supabase.' : ''}</Alert></div>}
      <BlogForm action={createBlogPost} categories={categories} knownTags={knownTags} publicSiteUrl={publicSiteUrl} />
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteBlogPost, updateBlogPost } from '@/lib/actions/blog'
import { effectiveStatus, statusTone, type BlogPostRow } from '@/lib/blog'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Badge, Card, PageHeader, buttonClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { BlogForm } from '../blog-form'
import { loadBlogFormData } from '../load-form-data'

export const metadata: Metadata = { title: 'Edit blog post' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditBlogPostPage({ params }: PageProps<'/blog/[id]'>) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const [{ data, error }, { categories, knownTags }] = await Promise.all([
    supabase.from('blog_posts').select('*').eq('id', id).maybeSingle(),
    loadBlogFormData(supabase),
  ])
  if (error) return <Alert tone="error">Could not load this post: {error.message}</Alert>
  if (!data) notFound()
  const post = data as BlogPostRow
  const status = effectiveStatus(post)

  return (
    <>
      <Link href="/blog" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All posts</Link>
      <PageHeader title={post.title}
        actions={<>
          <Badge tone={statusTone[status]}>{status}</Badge>
          <Link href={`/blog/${post.id}/preview`} className={buttonClass('secondary')}>Preview saved version</Link>
          {status === 'published' && <a href={`${publicSiteUrl}/blog/${post.slug}`} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>View on website ↗</a>}
        </>} />

      {/* Re-mount after each save so the form starts from the saved values. */}
      <BlogForm key={post.updated_at} action={updateBlogPost.bind(null, post.id)} post={post} categories={categories} knownTags={knownTags} publicSiteUrl={publicSiteUrl} />

      <Card className="mb-24 mt-2 flex flex-col gap-3 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-lg text-ink">Delete this post</p>
          <p className="text-sm text-muted">Removes the post and its uploaded images permanently. To hide it, unpublish it instead.</p>
        </div>
        <form action={deleteBlogPost.bind(null, post.id)}>
          <ConfirmButton message={`Permanently delete “${post.title}”?`}>Delete post</ConfirmButton>
        </form>
      </Card>
    </>
  )
}

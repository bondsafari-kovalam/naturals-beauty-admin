import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { effectiveStatus, formatDate, statusTone, type BlogPostRow } from '@/lib/blog'
import { sanitizeBlogHtml } from '@/lib/blog-html'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Badge, Card, buttonClass } from '@/components/ui'
import { BlogPreview } from '../../blog-preview'

export const metadata: Metadata = { title: 'Preview blog post', robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin-only preview of the saved post, including drafts and scheduled posts that visitors can't see yet.
export default async function BlogPostPreviewPage({ params }: PageProps<'/blog/[id]/preview'>) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const { data, error } = await supabase.from('blog_posts').select('*, category:blog_categories(name)').eq('id', id).maybeSingle()
  if (error) return <Alert tone="error">Could not load this post: {error.message}</Alert>
  if (!data) notFound()
  const post = data as BlogPostRow & { category: { name: string } | null }
  const status = effectiveStatus(post)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/blog" className="text-xs font-bold uppercase tracking-wider text-brand">← All posts</Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[status]}>{status}</Badge>
          <Link href={`/blog/${post.id}`} className={buttonClass('secondary')}>Edit post</Link>
          {status === 'published' && <a href={`${publicSiteUrl}/blog/${post.slug}`} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>View on website ↗</a>}
        </div>
      </div>
      {status !== 'published' && <div className="mb-4"><Alert tone="info">{status === 'draft' ? 'This is a draft. Visitors cannot see it until it is published.' : `Scheduled: visitors can see it from ${formatDate(post.published_at, true)}.`}</Alert></div>}
      <Card className="p-5 sm:p-10">
        <BlogPreview publicSiteUrl={publicSiteUrl} post={{
          title: post.title, excerpt: post.excerpt, categoryName: post.category?.name ?? '', image: post.featured_image ?? '', imageAlt: post.image_alt ?? '',
          imageCaption: post.image_caption ?? '', content: sanitizeBlogHtml(post.content), author: post.author_name ?? '', tags: post.tags,
          publishedLabel: post.published_at && status !== 'draft' ? formatDate(post.published_at) : 'Not published',
          lastReviewedLabel: post.last_reviewed_at ? formatDate(`${post.last_reviewed_at}T12:00:00+05:30`) : undefined,
        }} />
      </Card>
    </>
  )
}

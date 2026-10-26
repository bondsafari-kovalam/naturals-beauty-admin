import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteBlogPost, setBlogPostPublished } from '@/lib/actions/blog'
import { effectiveStatus, formatDate, imageSrc, statusTone, type BlogPostRow } from '@/lib/blog'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, buttonClass, inputClass } from '@/components/ui'
import { FilterForm } from '@/components/filter-form'
import { ConfirmButton } from '@/components/confirm-button'

export const metadata: Metadata = { title: 'Blog' }

const PAGE_SIZE = 10

// PostgREST's or()/ilike filters treat , ( ) as syntax, and % * as wildcards; strip them from user input.
const cleanSearch = (value: string) => value.replace(/[,()%*\\]/g, ' ').trim().slice(0, 100)

type ListRow = Pick<BlogPostRow, 'id' | 'title' | 'slug' | 'status' | 'is_featured' | 'published_at' | 'created_at' | 'updated_at' | 'featured_image' | 'author_name'> & { category: { name: string } | null }

export default async function BlogAdminPage({ searchParams }: PageProps<'/blog'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const q = cleanSearch(String(params.q ?? ''))
  const category = String(params.category ?? '')
  const status = String(params.status ?? '')
  const sort = params.sort === 'oldest' ? 'oldest' : 'newest'
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)
  const now = new Date().toISOString()

  // GET with limit(0) instead of HEAD: HEAD responses hide errors such as a missing table.
  const count = () => supabase.from('blog_posts').select('id', { count: 'exact' }).limit(0)
  let query = supabase.from('blog_posts')
    .select('id, title, slug, status, is_featured, published_at, created_at, updated_at, featured_image, author_name, category:blog_categories(name)', { count: 'exact' })
  if (q) query = query.ilike('title', `%${q}%`)
  if (category) query = query.eq('category_id', category)
  if (status === 'draft') query = query.eq('status', 'draft')
  if (status === 'published') query = query.in('status', ['published', 'scheduled']).lte('published_at', now)
  if (status === 'scheduled') query = query.in('status', ['published', 'scheduled']).gt('published_at', now)

  const [list, total, published, drafts, scheduled, recent, categories] = await Promise.all([
    query.order('created_at', { ascending: sort === 'oldest' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    count(),
    count().in('status', ['published', 'scheduled']).lte('published_at', now),
    count().eq('status', 'draft'),
    count().in('status', ['published', 'scheduled']).gt('published_at', now),
    supabase.from('blog_posts').select('id, title, status, published_at, updated_at').order('updated_at', { ascending: false }).limit(5),
    supabase.from('blog_categories').select('id, name').order('sort_order').order('name'),
  ])

  // A page past the end (e.g. an old link) is a PostgREST range error, not an empty list: start over.
  if (page > 1 && (list.error?.code === 'PGRST103' || (!list.error && (list.data ?? []).length === 0))) redirect('/blog')

  const posts = (list.data ?? []) as unknown as ListRow[]
  const filtered = Boolean(q || category || status)
  const filterParams = { ...(q && { q }), ...(category && { category }), ...(status && { status }), ...(sort === 'oldest' && { sort }) }
  const pageHref = (p: number) => `/blog?${new URLSearchParams({ ...filterParams, page: String(p) })}`
  const stats = [
    { label: 'Total posts', value: total.count, href: '/blog' },
    { label: 'Published', value: published.count, href: '/blog?status=published' },
    { label: 'Drafts', value: drafts.count, href: '/blog?status=draft' },
    { label: 'Scheduled', value: scheduled.count, href: '/blog?status=scheduled' },
  ]

  return <>
    <PageHeader title="Blog" description="Write, schedule and publish articles for the website’s blog."
      actions={<><Link href="/blog/categories" className={buttonClass('secondary')}>Categories</Link><Link href="/blog/new" className={buttonClass()}>+ Create new blog</Link></>} />
    {list.error && <div className="mb-4"><Alert tone="error">Could not load blog posts: {list.error.message}{list.error.code === 'PGRST205' ? ' — run 009_blog.sql in Supabase.' : ''}</Alert></div>}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href} className="rounded-md border border-line bg-white p-5 transition-colors hover:border-brand">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{stat.label}</p>
          <p className="mt-2 font-display text-4xl text-brand">{stat.value ?? '—'}</p>
        </Link>
      ))}
    </div>

    {(recent.data ?? []).length > 0 && (
      <Card className="mt-6">
        <h2 className="border-b border-line px-5 py-3 font-display text-lg text-ink">Recently updated</h2>
        <ul>{(recent.data ?? []).map((post) => {
          const live = effectiveStatus(post)
          return <li key={post.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 text-sm last:border-0">
            <Link href={`/blog/${post.id}`} className="truncate text-ink hover:text-brand">{post.title}</Link>
            <span className="flex shrink-0 items-center gap-3 text-xs text-muted"><Badge tone={statusTone[live]}>{live}</Badge>{formatDate(post.updated_at, true)}</span>
          </li>
        })}</ul>
      </Card>
    )}

    <FilterForm className="mb-4 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_190px_150px_140px_auto]">
      <label className="sr-only" htmlFor="q">Search by title</label>
      <input id="q" name="q" defaultValue={q} placeholder="Search by title" className={inputClass} />
      <label className="sr-only" htmlFor="category">Category</label>
      <select id="category" name="category" defaultValue={category} className={inputClass}>
        <option value="">All categories</option>
        {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="sr-only" htmlFor="status">Status</label>
      <select id="status" name="status" defaultValue={status} className={inputClass}>
        <option value="">All statuses</option><option value="published">Published</option><option value="draft">Drafts</option><option value="scheduled">Scheduled</option>
      </select>
      <label className="sr-only" htmlFor="sort">Sort</label>
      <select id="sort" name="sort" defaultValue={sort} className={inputClass}>
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
      </select>
      <div className="flex gap-2"><button type="submit" className={buttonClass('secondary')}>Filter</button>{filtered && <Link href="/blog" className={buttonClass('ghost')}>Clear</Link>}</div>
    </FilterForm>

    {!list.error && posts.length === 0
      ? <EmptyState title={filtered ? 'No posts match these filters.' : 'No blog posts yet.'}>{filtered ? <Link className="text-brand underline" href="/blog">Clear filters</Link> : <Link className="text-brand underline" href="/blog/new">Write your first article</Link>}</EmptyState>
      : <Card className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Post</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Author</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Published</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>{posts.map((post) => {
            const live = effectiveStatus(post)
            return <tr key={post.id} className="border-b border-line align-middle last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-20 shrink-0 overflow-hidden rounded bg-lavender">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {post.featured_image && <img src={imageSrc(post.featured_image, publicSiteUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <Link href={`/blog/${post.id}`} className="font-display text-base text-ink hover:text-brand">{post.title}</Link>
                    {post.is_featured && <span className="ml-2 align-middle"><Badge tone="brand">Featured</Badge></span>}
                    <span className="block truncate text-xs text-muted">/blog/{post.slug}</span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{post.category?.name ?? '—'}</td>
              <td className="px-4 py-3 text-muted">{post.author_name ?? '—'}</td>
              <td className="px-4 py-3"><Badge tone={statusTone[live]}>{live}</Badge></td>
              <td className="px-4 py-3 text-muted">{formatDate(post.created_at)}</td>
              <td className="px-4 py-3 text-muted">{post.status === 'draft' ? '—' : formatDate(post.published_at, live === 'scheduled')}</td>
              <td className="px-4 py-3 text-muted">{formatDate(post.updated_at)}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">
                {/* Editing opens from the post title. */}
                <form action={deleteBlogPost.bind(null, post.id)}><ConfirmButton variant="danger" message={`Delete “${post.title}”?`}>Delete</ConfirmButton></form>
                <Link href={`/blog/${post.id}/preview`} className={buttonClass('ghost', 'min-h-8 px-3')}>Preview</Link>
                <form action={setBlogPostPublished.bind(null, post.id, post.status === 'draft')}>
                  {post.status === 'draft'
                    ? <button type="submit" className={buttonClass('primary', 'min-h-8 px-3')}>Publish</button>
                    : <ConfirmButton variant="secondary" message={`Unpublish “${post.title}”? It moves to drafts and disappears from the website.`}>Unpublish</ConfirmButton>}
                </form>
              </div></td>
            </tr>
          })}</tbody>
        </table>
      </Card>}
    <Pagination page={page} pageSize={PAGE_SIZE} total={list.count ?? 0} href={pageHref} />
  </>
}

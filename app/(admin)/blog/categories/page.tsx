import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteBlogCategory } from '@/lib/actions/blog'
import type { BlogCategoryRow } from '@/lib/blog'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { BlogCategoryForm } from './blog-category-form'

export const metadata: Metadata = { title: 'Blog categories' }

const PAGE_SIZE = 10

export default async function BlogCategoriesPage({ searchParams }: PageProps<'/blog/categories'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)
  const [{ data, count, error }, { data: postRows }] = await Promise.all([
    supabase.from('blog_categories').select('*', { count: 'exact' }).order('sort_order').order('name').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('blog_posts').select('category_id'),
  ])
  const categories = (data ?? []) as BlogCategoryRow[]
  const total = count ?? 0
  // A page past the end (e.g. an old link) is a PostgREST range error, not an empty list: start over.
  if (page > 1 && (error?.code === 'PGRST103' || (!error && categories.length === 0))) redirect('/blog/categories')
  const usage = new Map<string, number>()
  for (const { category_id } of postRows ?? []) usage.set(category_id, (usage.get(category_id) ?? 0) + 1)

  return <>
    <Link href="/blog" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All posts</Link>
    <PageHeader title="Blog categories" description="Categories for blog posts. Visitors can filter the blog by these on the website." />
    {error && <div className="mb-4"><Alert tone="error">Could not load categories: {error.message}{error.code === 'PGRST205' ? ' — run 009_blog.sql in Supabase.' : ''}</Alert></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      {!error && total === 0 ? <EmptyState title="No categories yet.">Add your first category using the form.</EmptyState> : <div><Card className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Posts</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>{categories.map((category) => {
            const used = usage.get(category.id) ?? 0
            return <tr key={category.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3"><span className="font-display text-base text-ink">{category.name}</span><span className="block text-xs text-muted">/blog?category={category.slug}</span></td>
              <td className="px-4 py-3">{used ? <Link href={`/blog?${new URLSearchParams({ category: category.id })}`} className="text-brand hover:underline">{used} post{used === 1 ? '' : 's'}</Link> : <Badge>Unused</Badge>}</td>
              <td className="px-4 py-3"><div className="flex justify-end">
                <form action={deleteBlogCategory.bind(null, category.id)}><ConfirmButton variant="danger" message={`Delete “${category.name}”?`}>Delete</ConfirmButton></form>
              </div></td>
            </tr>
          })}</tbody>
        </table>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => `/blog/categories?page=${p}`} /></div>}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 font-display text-xl text-ink">New category</h2>
        <BlogCategoryForm />
      </Card>
    </div>
  </>
}

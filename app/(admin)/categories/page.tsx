import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteCategory } from '@/lib/actions/categories'
import type { CategoryRow } from '@/lib/categories'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { CategoryForm } from './category-form'

export const metadata: Metadata = { title: 'Categories' }

const PAGE_SIZE = 10

export default async function CategoriesPage({ searchParams }: PageProps<'/categories'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)
  const [{ data, count, error }, { data: courseRows }] = await Promise.all([
    supabase.from('course_categories').select('*', { count: 'exact' }).order('sort_order').order('name').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('courses').select('category'),
  ])
  const categories = (data ?? []) as CategoryRow[]
  const total = count ?? 0
  // A page past the end (e.g. an old link) is a PostgREST range error, not an empty list: start over.
  if (page > 1 && (error?.code === 'PGRST103' || (!error && categories.length === 0))) redirect('/categories')
  const usage = new Map<string, number>()
  for (const { category } of courseRows ?? []) usage.set(category, (usage.get(category) ?? 0) + 1)

  return <>
    <Link href="/courses" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All courses</Link>
    <PageHeader title="Categories" description="Course categories used in the course form and as filters on the website’s course carousel." />
    {error && <div className="mb-4"><Alert tone="error">Could not load categories: {error.message}{error.code === 'PGRST205' ? ' — run 008_course_categories.sql in Supabase.' : ''}</Alert></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      {!error && total === 0 ? <EmptyState title="No categories yet.">Add your first category using the form.</EmptyState> : <div><Card className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Courses</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>{categories.map((category) => {
            const count = usage.get(category.name) ?? 0
            return <tr key={category.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-display text-base text-ink">{category.name}</td>
              <td className="px-4 py-3">{count ? <Link href={`/courses?${new URLSearchParams({ category: category.name })}`} className="text-brand hover:underline">{count} course{count === 1 ? '' : 's'}</Link> : <Badge>Unused</Badge>}</td>
              <td className="px-4 py-3"><div className="flex justify-end">
                <form action={deleteCategory.bind(null, category.id)}><ConfirmButton variant="danger" message={`Delete “${category.name}”?`}>Delete</ConfirmButton></form>
              </div></td>
            </tr>
          })}</tbody>
        </table>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => `/categories?page=${p}`} /></div>}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 font-display text-xl text-ink">New category</h2>
        <CategoryForm />
      </Card>
    </div>
  </>
}

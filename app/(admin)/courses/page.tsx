import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { setCoursePublished } from '@/lib/actions/courses'
import type { CourseRow } from '@/lib/courses'
import { loadCategoryNames } from '@/lib/categories'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, buttonClass, inputClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'

export const metadata: Metadata = { title: 'Courses' }

const PAGE_SIZE = 10

// PostgREST's or() filter treats , ( ) as syntax, and % * as wildcards; strip them from user input.
const cleanSearch = (value: string) => value.replace(/[,()%*\\]/g, ' ').trim().slice(0, 100)

export default async function CoursesPage({ searchParams }: PageProps<'/courses'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const q = cleanSearch(String(params.q ?? ''))
  const category = String(params.category ?? '')
  const status = String(params.status ?? '')
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)

  let query = supabase.from('courses').select('id, slug, title, category, duration, sort_order, is_published, updated_at', { count: 'exact' })
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
  if (category) query = query.eq('category', category)
  if (status === 'published') query = query.eq('is_published', true)
  if (status === 'draft') query = query.eq('is_published', false)
  const [{ data, count, error }, categories] = await Promise.all([
    query
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    loadCategoryNames(supabase),
  ])

  const courses = (data ?? []) as Pick<CourseRow, 'id' | 'slug' | 'title' | 'category' | 'duration' | 'sort_order' | 'is_published' | 'updated_at'>[]
  const pageHref = (p: number) => `/courses?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(status && { status }), page: String(p) })}`
  // A page past the end (e.g. after deleting rows) makes PostgREST reject the range; go back to page 1.
  if (error?.code === 'PGRST103') redirect(pageHref(1))

  return (
    <>
      <PageHeader title="Courses" description="Courses shown on the website’s homepage carousel, /courses and each course page. Only published courses are visible to visitors."
        actions={<><Link href="/categories" className={buttonClass('secondary')}>Categories</Link><Link href="/courses/new" className={buttonClass()}>+ New course</Link></>} />

      <div className="mb-4 flex flex-col gap-3">
        {error && <Alert tone="error">Could not load courses: {error.message}{error.code === 'PGRST205' ? ' — run 002_courses.sql in the Supabase SQL Editor.' : ''}</Alert>}
      </div>

      <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_160px_auto]" role="search">
        <label className="sr-only" htmlFor="q">Search courses</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search title or slug" className={inputClass} />
        <label className="sr-only" htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={category} className={inputClass}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className={inputClass}>
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className={buttonClass('secondary')}>Filter</button>
      </form>

      {!error && courses.length === 0 ? (
        <EmptyState title={q || category || status ? 'No courses match these filters.' : 'No courses yet.'}>
          {q || category || status ? <Link className="text-brand underline" href="/courses">Clear filters</Link> : <>Run <code>003_courses_seed.sql</code> to import the existing 20 courses, or <Link className="text-brand underline" href="/courses/new">add a course</Link>.</>}
        </EmptyState>
      ) : courses.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">Position</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-muted">{course.sort_order}</td>
                  <td className="px-4 py-3"><Link href={`/courses/${course.id}`} className="font-display text-base text-ink hover:text-brand">{course.title}</Link><span className="block text-xs text-muted">/courses/{course.slug}</span></td>
                  <td className="px-4 py-3 text-muted">{course.category}</td>
                  <td className="px-4 py-3 text-muted">{course.duration ?? '—'}</td>
                  <td className="px-4 py-3">{course.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/courses/${course.id}`} className={buttonClass('secondary', 'min-h-8 px-3')}>Edit</Link>
                      <form action={setCoursePublished.bind(null, course.id, !course.is_published)}>
                        {course.is_published
                          ? <ConfirmButton variant="secondary" message={`Unpublish “${course.title}”? It will disappear from the website.`}>Unpublish</ConfirmButton>
                          : <button type="submit" className={buttonClass('primary', 'min-h-8 px-3')}>Publish</button>}
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} href={pageHref} />
    </>
  )
}

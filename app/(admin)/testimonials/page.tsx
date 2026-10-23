import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteTestimonial, setTestimonialPublished } from '@/lib/actions/testimonials'
import type { TestimonialRow } from '@/lib/testimonials'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, buttonClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'

export const metadata: Metadata = { title: 'Testimonials' }

const PAGE_SIZE = 10

export default async function TestimonialsAdminPage({ searchParams }: PageProps<'/testimonials'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)
  const { data, count, error } = await supabase.from('testimonials').select('*', { count: 'exact' }).order('sort_order').order('created_at')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const testimonials = (data ?? []) as TestimonialRow[]
  const total = count ?? 0
  // A page past the end (e.g. an old link) is a PostgREST range error, not an empty list: start over.
  if (page > 1 && (error?.code === 'PGRST103' || (!error && testimonials.length === 0))) redirect('/testimonials')
  return <>
    <PageHeader title="Testimonials" description="Student testimonials shown on the homepage. Only published ones are visible to visitors." actions={<Link href="/testimonials/new" className={buttonClass()}>+ New testimonial</Link>} />
    <div className="mb-4">{error && <Alert tone="error">Could not load testimonials: {error.message}{error.code === 'PGRST205' ? ' — run 011_testimonials.sql in Supabase.' : ''}</Alert>}</div>
    {!error && total === 0 ? <EmptyState title="No testimonials yet.">Add real, approved student testimonials here. The homepage section stays hidden until one is published.</EmptyState> : <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Testimonial</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{testimonials.map((t) => <tr key={t.id} className="border-b border-line last:border-0"><td className="px-4 py-3 text-muted">{t.sort_order}</td><td className="px-4 py-3"><Link href={`/testimonials/${t.id}`} className="font-display text-base text-ink hover:text-brand">{t.name}</Link><span className="block text-xs text-muted">{[t.course, t.location].filter(Boolean).join(' · ')}</span></td><td className="max-w-xs px-4 py-3 text-muted"><span className="line-clamp-2">{t.quote}</span></td><td className="px-4 py-3 text-amber-600" aria-label={`${t.rating} out of 5`}>{'★'.repeat(t.rating)}</td><td className="px-4 py-3">{t.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Link href={`/testimonials/${t.id}`} className={buttonClass('secondary', 'min-h-8 px-3')}>Edit</Link><form action={setTestimonialPublished.bind(null, t.id, !t.is_published)}>{t.is_published ? <ConfirmButton variant="secondary" message={`Unpublish the testimonial from “${t.name}”?`}>Unpublish</ConfirmButton> : <button type="submit" className={buttonClass('primary', 'min-h-8 px-3')}>Publish</button>}</form><form action={deleteTestimonial.bind(null, t.id)}><ConfirmButton variant="danger" message={`Delete the testimonial from “${t.name}”?`}>Delete</ConfirmButton></form></div></td></tr>)}</tbody></table></Card>}
    <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => `/testimonials?page=${p}`} />
  </>
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteFaculty, setFacultyPublished } from '@/lib/actions/faculty'
import { FACULTY_SECTION_LABELS, type FacultyRow } from '@/lib/faculty'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, buttonClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'

export const metadata: Metadata = { title: 'Faculty' }

const PAGE_SIZE = 10

export default async function FacultyAdminPage({ searchParams }: PageProps<'/faculty'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)
  const { data, count, error } = await supabase.from('faculty').select('*', { count: 'exact' }).order('section').order('sort_order').order('name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const faculty = (data ?? []) as FacultyRow[]
  const total = count ?? 0
  // A page past the end (e.g. an old link) is a PostgREST range error, not an empty list: start over.
  if (page > 1 && (error?.code === 'PGRST103' || (!error && faculty.length === 0))) redirect('/faculty')
  return <>
    <PageHeader title="Faculty" description="Manage the academy head, senior faculty and trainers shown on the public faculty page." actions={<Link href="/faculty/new" className={buttonClass()}>+ New profile</Link>} />
    <div className="mb-4">{error && <Alert tone="error">Could not load faculty: {error.message}{error.code === 'PGRST205' ? ' — run 006_faculty.sql in Supabase.' : ''}</Alert>}</div>
    {!error && total === 0 ? <EmptyState title="No faculty profiles yet.">Add the academy head, senior faculty and trainers here.</EmptyState> : <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{faculty.map((member) => <tr key={member.id} className="border-b border-line last:border-0"><td className="px-4 py-3 text-muted">{member.sort_order}</td><td className="px-4 py-3"><Link href={`/faculty/${member.id}`} className="font-display text-base text-ink hover:text-brand">{member.name}</Link><span className="block text-xs text-muted">{member.role}</span></td><td className="px-4 py-3 text-muted">{member.department}</td><td className="px-4 py-3 text-muted">{FACULTY_SECTION_LABELS[member.section]}</td><td className="px-4 py-3">{member.is_published ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Link href={`/faculty/${member.id}`} className={buttonClass('secondary', 'min-h-8 px-3')}>Edit</Link><form action={setFacultyPublished.bind(null, member.id, !member.is_published)}>{member.is_published ? <ConfirmButton variant="secondary" message={`Unpublish “${member.name}”?`}>Unpublish</ConfirmButton> : <button type="submit" className={buttonClass('primary', 'min-h-8 px-3')}>Publish</button>}</form><form action={deleteFaculty.bind(null, member.id)}><ConfirmButton variant="danger" message={`Delete “${member.name}”?`}>Delete</ConfirmButton></form></div></td></tr>)}</tbody></table></Card>}
    <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => `/faculty?page=${p}`} />
  </>
}

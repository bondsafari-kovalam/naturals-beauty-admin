import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { ENQUIRY_STATUSES, formatDateTime, statusTone, type EnquiryRow } from '@/lib/enquiries'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, buttonClass, inputClass } from '@/components/ui'
import { FilterForm } from '@/components/filter-form'

export const metadata: Metadata = { title: 'Enquiries' }

const PAGE_SIZE = 25
const cleanSearch = (value: string) => value.replace(/[,()%*\\]/g, ' ').trim().slice(0, 100)

export default async function EnquiriesPage({ searchParams }: PageProps<'/enquiries'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const q = cleanSearch(String(params.q ?? ''))
  const status = ENQUIRY_STATUSES.includes(params.status as never) ? String(params.status) : ''
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)

  let query = supabase.from('enquiries').select('id, created_at, name, email, phone, source, status', { count: 'exact' })
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
  if (status) query = query.eq('status', status)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const enquiries = (data ?? []) as Pick<EnquiryRow, 'id' | 'created_at' | 'name' | 'email' | 'phone' | 'source' | 'status'>[]
  const filters = { ...(q && { q }), ...(status && { status }) }
  const pageHref = (p: number) => `/enquiries?${new URLSearchParams({ ...filters, page: String(p) })}`
  // A page past the end (e.g. after deleting rows) makes PostgREST reject the range; go back to page 1.
  if (error?.code === 'PGRST103') redirect(pageHref(1))

  return (
    <>
      <PageHeader title="Enquiries" description="Messages sent through the website’s contact form. Private: only admins can see them."
        actions={<a href={`/enquiries/export?${new URLSearchParams(filters)}`} className={buttonClass('secondary')}>Export CSV</a>} />
      <div className="mb-4 flex flex-col gap-3">
        {error && <Alert tone="error">Could not load enquiries: {error.message}{error.code === 'PGRST205' ? ' — run 001_enquiries.sql in the Supabase SQL Editor.' : ''}</Alert>}
      </div>

      <FilterForm className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <label className="sr-only" htmlFor="q">Search enquiries</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search name, email or phone" className={inputClass} />
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className={inputClass}>
          <option value="">Any status</option>
          {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button type="submit" className={buttonClass('secondary')}>Filter</button>
      </FilterForm>

      {!error && enquiries.length === 0 ? (
        <EmptyState title={q || status ? 'No enquiries match these filters.' : 'No enquiries yet.'}>{q || status ? <Link className="text-brand underline" href="/enquiries">Clear filters</Link> : 'New contact-form messages will appear here.'}</EmptyState>
      ) : enquiries.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">Received</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              {enquiries.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(e.created_at)}</td>
                  <td className="px-4 py-3"><Link href={`/enquiries/${e.id}`} className="font-display text-base text-ink hover:text-brand">{e.name}</Link></td>
                  <td className="px-4 py-3 text-muted">{e.email}{e.phone && <span className="block">{e.phone}</span>}</td>
                  <td className="px-4 py-3 text-muted">{e.source}</td>
                  <td className="px-4 py-3"><Badge tone={statusTone[e.status]}>{e.status}</Badge></td>
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

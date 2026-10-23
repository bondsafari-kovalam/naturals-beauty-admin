import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteRegistration, setRegistrationStatus } from '@/lib/actions/workshops'
import { REGISTRATION_STATUSES, campaignLabel, registrationStatusTone, type RegistrationRow } from '@/lib/workshops'
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, buttonClass, inputClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'

export const metadata: Metadata = { title: 'Workshop registrations' }

const PAGE_SIZE = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST's or() filter treats , ( ) as syntax, and % * as wildcards; strip them from user input.
const cleanSearch = (value: string) => value.replace(/[,()%*\\]/g, ' ').trim().slice(0, 100)
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value))

type Row = RegistrationRow & { workshop: { title: string; date: string } | null }

export default async function RegistrationsPage({ searchParams }: PageProps<'/workshops/registrations'>) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const q = cleanSearch(String(params.q ?? ''))
  const workshop = UUID.test(String(params.workshop ?? '')) ? String(params.workshop) : ''
  const status = REGISTRATION_STATUSES.includes(String(params.status ?? '') as never) ? String(params.status) : ''
  const page = Math.max(1, Number.parseInt(String(params.page ?? '1'), 10) || 1)

  let query = supabase.from('workshop_registrations').select('*, workshop:workshops(title, date)', { count: 'exact' })
  if (q) {
    const digits = q.replace(/\D/g, '')
    query = query.or([`full_name.ilike.%${q}%`, ...(digits.length >= 3 ? [`phone.ilike.%${digits}%`] : [])].join(','))
  }
  if (workshop) query = query.eq('workshop_id', workshop)
  if (status) query = query.eq('status', status)

  const [list, workshops] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('workshops').select('id, title, date').order('date', { ascending: false }),
  ])
  if (page > 1 && (list.error?.code === 'PGRST103' || (!list.error && (list.data ?? []).length === 0))) redirect('/workshops/registrations')

  const rows = (list.data ?? []) as unknown as Row[]
  const filters = { ...(q && { q }), ...(workshop && { workshop }), ...(status && { status }) }
  const filtered = Object.keys(filters).length > 0
  const here = `/workshops/registrations${filtered || page > 1 ? `?${new URLSearchParams({ ...filters, ...(page > 1 && { page: String(page) }) })}` : ''}`
  const exportHref = `/workshops/registrations/export${filtered ? `?${new URLSearchParams(filters)}` : ''}`

  return <>
    <Link href="/workshops" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All workshops</Link>
    <PageHeader title="Workshop registrations" description="Everyone who registered on a workshop campaign page. Call or WhatsApp them to confirm, then update the status."
      actions={<a href={exportHref} className={buttonClass('secondary')}>Export CSV</a>} />
    {list.error && <div className="mb-4"><Alert tone="error">Could not load registrations: {list.error.message}{list.error.code === 'PGRST205' ? ' — run 010_workshop_campaigns.sql in Supabase.' : ''}</Alert></div>}

    <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_260px_170px_auto]" role="search">
      <label className="sr-only" htmlFor="q">Search by name or phone</label>
      <input id="q" name="q" defaultValue={q} placeholder="Search by name or phone" className={inputClass} />
      <label className="sr-only" htmlFor="workshop">Workshop</label>
      <select id="workshop" name="workshop" defaultValue={workshop} className={inputClass}>
        <option value="">All workshops</option>
        {(workshops.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.title} · {w.date}</option>)}
      </select>
      <label className="sr-only" htmlFor="status">Status</label>
      <select id="status" name="status" defaultValue={status} className={inputClass}>
        <option value="">All statuses</option>
        {REGISTRATION_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
      </select>
      <div className="flex gap-2"><button type="submit" className={buttonClass('secondary')}>Filter</button>{filtered && <Link href="/workshops/registrations" className={buttonClass('ghost')}>Clear</Link>}</div>
    </form>

    {!list.error && rows.length === 0
      ? <EmptyState title={filtered ? 'No registrations match these filters.' : 'No registrations yet.'}>{filtered ? <Link className="text-brand underline" href="/workshops/registrations">Clear filters</Link> : 'Publish a workshop and share its campaign link to start receiving registrations.'}</EmptyState>
      : <Card className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Registered</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Workshop</th><th className="px-4 py-3">Campaign source</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-line align-top last:border-0">
            <td className="px-4 py-3 text-muted">{formatDate(row.created_at)}</td>
            <td className="px-4 py-3">
              <span className="font-display text-base text-ink">{row.full_name}</span>
              <a href={`tel:${row.phone}`} className="block text-brand hover:underline">{row.phone}</a>
              {row.email && <a href={`mailto:${row.email}`} className="block text-xs text-muted hover:text-brand">{row.email}</a>}
              {row.message && <p className="mt-1 max-w-xs whitespace-pre-line text-xs text-muted">“{row.message}”</p>}
            </td>
            <td className="px-4 py-3 text-muted">{row.workshop ? <Link href={`/workshops/registrations?workshop=${row.workshop_id}`} className="hover:text-brand">{row.workshop.title}<span className="block text-xs">{row.workshop.date}</span></Link> : '—'}</td>
            <td className="px-4 py-3 text-muted">{campaignLabel(row)}{row.utm_content && <span className="block text-xs">Ad: {row.utm_content}</span>}</td>
            <td className="px-4 py-3"><Badge tone={registrationStatusTone[row.status]}>{row.status}</Badge></td>
            <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-2">
              <form action={setRegistrationStatus.bind(null, row.id, here)} className="flex gap-2">
                <label className="sr-only" htmlFor={`status-${row.id}`}>Status for {row.full_name}</label>
                <select id={`status-${row.id}`} name="status" defaultValue={row.status} className={`${inputClass} min-h-8 w-32 py-1`}>{REGISTRATION_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
                <button type="submit" className={buttonClass('secondary', 'min-h-8 px-3')}>Save</button>
              </form>
              <a href={`https://wa.me/${row.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={buttonClass('ghost', 'min-h-8 px-3')}>WhatsApp</a>
              <form action={deleteRegistration.bind(null, row.id, here)}><ConfirmButton variant="danger" message={`Delete the registration from ${row.full_name}?`}>Delete</ConfirmButton></form>
            </div></td>
          </tr>)}</tbody>
        </table>
      </Card>}
    <Pagination page={page} pageSize={PAGE_SIZE} total={list.count ?? 0} href={(p) => `/workshops/registrations?${new URLSearchParams({ ...filters, page: String(p) })}`} />
  </>
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { deleteWorkshop, setWorkshopStatus } from '@/lib/actions/workshops'
import { workshopStatusTone, type WorkshopRow } from '@/lib/workshops'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Badge, Card, EmptyState, PageHeader, buttonClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { CopyButton } from '@/components/copy-button'

export const metadata: Metadata = { title: 'Workshops' }

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const todayInIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

export default async function WorkshopsAdminPage() {
  const { supabase } = await requireAdmin()
  const [{ data, error }, registrations] = await Promise.all([
    supabase.from('workshops').select('*').order('date', { ascending: false }).order('sort_order'),
    supabase.from('workshop_registrations').select('workshop_id, status'),
  ])
  const workshops = (data ?? []) as WorkshopRow[]
  const counts = new Map<string, { total: number; active: number }>()
  for (const row of registrations.data ?? []) {
    const entry = counts.get(row.workshop_id) ?? { total: 0, active: 0 }
    entry.total += 1
    if (row.status !== 'cancelled') entry.active += 1
    counts.set(row.workshop_id, entry)
  }
  const today = todayInIndia()
  const migrationMissing = error?.code === '42703' || registrations.error?.code === 'PGRST205'

  return <>
    <PageHeader title="Workshops" description="Plan workshops, share their campaign links and follow registrations."
      actions={<><Link href="/workshops/registrations" className={buttonClass('secondary')}>Registrations</Link><Link href="/workshops/new" className={buttonClass()}>+ New workshop</Link></>} />
    {(error || migrationMissing) && <div className="mb-4"><Alert tone="error">{migrationMissing ? 'Workshop campaigns are not set up yet — run supabase/migrations/010_workshop_campaigns.sql in the Supabase SQL Editor.' : `Could not load workshops: ${error?.message}${error?.code === 'PGRST205' ? ' — run 007_workshops.sql in Supabase.' : ''}`}</Alert></div>}
    {!error && workshops.length === 0 ? <EmptyState title="No workshops yet.">Add your next workshop, publish it, then share its campaign link.</EmptyState> : <Card className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-line bg-soft text-[10px] font-bold uppercase tracking-wider text-muted">
          <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Workshop</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Registrations</th><th className="px-4 py-3 text-right">Actions</th></tr>
        </thead>
        <tbody>{workshops.map((workshop) => {
          const url = `${publicSiteUrl}/workshops/${workshop.slug}`
          const count = counts.get(workshop.id) ?? { total: 0, active: 0 }
          const past = workshop.date < today
          return <tr key={workshop.id} className="border-b border-line align-middle last:border-0">
            <td className="px-4 py-3 text-muted"><span className={past ? 'line-through decoration-line' : ''}>{dateLabel(workshop.date)}</span><span className="block text-xs">{workshop.time_label}</span></td>
            <td className="px-4 py-3"><Link href={`/workshops/${workshop.id}`} className="font-display text-base text-ink hover:text-brand">{workshop.title}</Link><span className="block text-xs text-muted">/workshops/{workshop.slug}</span></td>
            <td className="px-4 py-3"><Badge tone={workshopStatusTone[workshop.status] ?? 'neutral'}>{workshop.status}</Badge>{workshop.status === 'published' && (past ? <span className="mt-1 block text-xs text-muted">Date passed</span> : !workshop.registration_open && <span className="mt-1 block text-xs text-amber-700">Registration closed</span>)}</td>
            <td className="px-4 py-3"><Link href={`/workshops/registrations?workshop=${workshop.id}`} className="text-brand hover:underline">{count.total} registration{count.total === 1 ? '' : 's'}</Link>{workshop.total_seats && <span className="block text-xs text-muted">{Math.max(workshop.total_seats - count.active, 0)} of {workshop.total_seats} seats left</span>}</td>
            <td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-2">
              <Link href={`/workshops/${workshop.id}`} className={buttonClass('secondary', 'min-h-8 px-3')}>Edit</Link>
              <CopyButton text={url} label="Copy link" className="min-h-8 px-3" />
              {workshop.status === 'published' && <a href={url} target="_blank" rel="noreferrer" className={buttonClass('ghost', 'min-h-8 px-3')}>Preview ↗</a>}
              {workshop.status !== 'published' && <form action={setWorkshopStatus.bind(null, workshop.id, 'published')}><button type="submit" className={buttonClass('primary', 'min-h-8 px-3')}>Publish</button></form>}
              {workshop.status === 'published' && <form action={setWorkshopStatus.bind(null, workshop.id, 'draft')}><ConfirmButton variant="secondary" message={`Unpublish “${workshop.title}”? Its campaign page stops working until you publish it again.`}>Unpublish</ConfirmButton></form>}
              {workshop.status === 'published' && past && <form action={setWorkshopStatus.bind(null, workshop.id, 'completed')}><button type="submit" className={buttonClass('secondary', 'min-h-8 px-3')}>Mark completed</button></form>}
              {workshop.status !== 'cancelled' && workshop.status !== 'completed' && <form action={setWorkshopStatus.bind(null, workshop.id, 'cancelled')}><ConfirmButton variant="danger" message={`Cancel “${workshop.title}”? It disappears from the website and stops taking registrations. Remember to inform registered students.`}>Cancel</ConfirmButton></form>}
              {count.total === 0 && <form action={deleteWorkshop.bind(null, workshop.id)}><ConfirmButton variant="danger" message={`Delete “${workshop.title}”?`}>Delete</ConfirmButton></form>}
            </div></td>
          </tr>
        })}</tbody>
      </table>
    </Card>}
  </>
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteWorkshop, updateWorkshop } from '@/lib/actions/workshops'
import { workshopStatusTone, type WorkshopRow } from '@/lib/workshops'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Badge, Card, PageHeader, buttonClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { WorkshopForm } from '../workshop-form'

export const metadata: Metadata = { title: 'Edit workshop' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EditWorkshopPage({ params }: PageProps<'/workshops/[id]'>) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const [{ data }, { count }] = await Promise.all([
    supabase.from('workshops').select('*').eq('id', id).maybeSingle(),
    supabase.from('workshop_registrations').select('id', { count: 'exact' }).eq('workshop_id', id).limit(0),
  ])
  if (!data) notFound()
  const workshop = data as WorkshopRow

  return <>
    <Link href="/workshops" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All workshops</Link>
    <PageHeader title={workshop.title} description="Update this workshop and its campaign page."
      actions={<>
        {workshop.status && <Badge tone={workshopStatusTone[workshop.status] ?? 'neutral'}>{workshop.status}</Badge>}
        <Link href={`/workshops/registrations?workshop=${workshop.id}`} className={buttonClass('secondary')}>Registrations ({count ?? 0})</Link>
        {workshop.status === 'published' && workshop.slug && <a href={`${publicSiteUrl}/workshops/${workshop.slug}`} target="_blank" rel="noreferrer" className={buttonClass('ghost')}>View campaign page ↗</a>}
      </>} />
    <WorkshopForm key={workshop.updated_at} action={updateWorkshop.bind(null, id)} workshop={workshop} publicSiteUrl={publicSiteUrl} submitLabel="Save changes" />
    <Card className="mt-8 flex flex-col gap-3 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><h2 className="font-semibold text-ink">Delete workshop</h2><p className="text-sm text-muted">{count ? 'This workshop has registrations, so it cannot be deleted. Set its status to Cancelled or Completed instead.' : 'This removes the workshop from the admin and the website.'}</p></div>
      {!count && <form action={deleteWorkshop.bind(null, id)}><ConfirmButton variant="danger" message={`Delete “${workshop.title}”?`}>Delete workshop</ConfirmButton></form>}
    </Card>
  </>
}

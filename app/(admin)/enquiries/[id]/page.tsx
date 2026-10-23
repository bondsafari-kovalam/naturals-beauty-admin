import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteEnquiry, updateEnquiry } from '@/lib/actions/enquiries'
import { ENQUIRY_STATUSES, formatDateTime, statusTone, type EnquiryRow } from '@/lib/enquiries'
import { Alert, Badge, Card, Field, PageHeader, buttonClass, inputClass } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'

export const metadata: Metadata = { title: 'Enquiry' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EnquiryPage({ params }: PageProps<'/enquiries/[id]'>) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const { data, error } = await supabase.from('enquiries').select('*').eq('id', id).maybeSingle()
  if (error) return <Alert tone="error">Could not load this enquiry: {error.message}</Alert>
  if (!data) notFound()
  const enquiry = data as EnquiryRow

  return (
    <>
      <Link href="/enquiries" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All enquiries</Link>
      <PageHeader title={enquiry.name} description={`Received ${formatDateTime(enquiry.created_at)} · via ${enquiry.source}`} actions={<Badge tone={statusTone[enquiry.status]}>{enquiry.status}</Badge>} />
      <div className="mb-4 flex flex-col gap-3">
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">Submitted by the visitor</h2>
          <dl className="grid gap-4 text-sm">
            <div><dt className="text-xs text-muted">Email</dt><dd><a className="text-brand underline" href={`mailto:${enquiry.email}`}>{enquiry.email}</a></dd></div>
            <div><dt className="text-xs text-muted">Phone</dt><dd>{enquiry.phone ? <a className="text-brand underline" href={`tel:${enquiry.phone.replace(/\s/g, '')}`}>{enquiry.phone}</a> : '—'}</dd></div>
            <div><dt className="text-xs text-muted">Message</dt><dd className="whitespace-pre-wrap leading-relaxed text-ink">{enquiry.message}</dd></div>
          </dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">Follow-up</h2>
          <form action={updateEnquiry.bind(null, enquiry.id)} className="flex flex-col gap-4">
            <Field label="Status" name="status" required>
              <select id="status" name="status" defaultValue={enquiry.status} className={inputClass}>
                {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Notes" name="notes" hint="Private notes for the team, e.g. “Called 21 Oct, interested in the evening batch”.">
              <textarea id="notes" name="notes" defaultValue={enquiry.notes ?? ''} className={`${inputClass} min-h-32`} />
            </Field>
            <button type="submit" className={buttonClass()}>Save follow-up</button>
          </form>
        </Card>
      </div>

      <Card className="mt-8 flex flex-col gap-3 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-lg text-ink">Delete this enquiry</p>
          <p className="text-sm text-muted">Use this if the visitor asks for their details to be removed, or for spam.</p>
        </div>
        <form action={deleteEnquiry.bind(null, enquiry.id)}>
          <ConfirmButton message={`Permanently delete the enquiry from ${enquiry.name}? This cannot be undone.`}>Delete enquiry</ConfirmButton>
        </form>
      </Card>
    </>
  )
}

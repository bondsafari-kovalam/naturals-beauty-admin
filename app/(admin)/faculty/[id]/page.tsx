import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteFaculty, updateFaculty } from '@/lib/actions/faculty'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Card, PageHeader } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { FacultyForm } from '../faculty-form'

export const metadata: Metadata = { title: 'Edit faculty profile' }
export default async function EditFacultyPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  const { data, error } = await supabase.from('faculty').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  return <><Link href="/faculty" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All faculty</Link><PageHeader title={`Edit ${data.name}`} description="Update this faculty profile." /><FacultyForm action={updateFaculty.bind(null, id)} faculty={data} publicSiteUrl={publicSiteUrl} submitLabel="Save changes" /><Card className="mt-8 flex flex-col gap-3 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-semibold text-ink">Delete profile</h2><p className="text-sm text-muted">This removes the profile from the admin and public faculty page.</p></div><form action={deleteFaculty.bind(null, id)}><ConfirmButton variant="danger" message={`Delete “${data.name}”?`}>Delete profile</ConfirmButton></form></Card>{error && <Alert tone="error">{error.message}</Alert>}</>
}

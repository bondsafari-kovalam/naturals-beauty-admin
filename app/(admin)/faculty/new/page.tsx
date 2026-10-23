import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { createFaculty } from '@/lib/actions/faculty'
import { publicSiteUrl } from '@/lib/supabase/env'
import { PageHeader } from '@/components/ui'
import { FacultyForm } from '../faculty-form'

export const metadata: Metadata = { title: 'New faculty profile' }
export default async function NewFacultyPage() {
  await requireAdmin()
  return <><Link href="/faculty" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All faculty</Link><PageHeader title="New faculty profile" description="Add an academy head, senior faculty or trainer." /><FacultyForm action={createFaculty} publicSiteUrl={publicSiteUrl} submitLabel="Create profile" /></>
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { createWorkshop } from '@/lib/actions/workshops'
import { publicSiteUrl } from '@/lib/supabase/env'
import { PageHeader } from '@/components/ui'
import { WorkshopForm } from '../workshop-form'

export const metadata: Metadata = { title: 'New workshop' }
export default async function NewWorkshopPage() { await requireAdmin(); return <><Link href="/workshops" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All workshops</Link><PageHeader title="New workshop" description="Add a workshop and publish it when the details are ready." /><WorkshopForm action={createWorkshop} publicSiteUrl={publicSiteUrl} submitLabel="Create workshop" /></> }

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/dal'
import { createTestimonial } from '@/lib/actions/testimonials'
import { PageHeader } from '@/components/ui'
import { TestimonialForm } from '../testimonial-form'

export const metadata: Metadata = { title: 'New testimonial' }
export default async function NewTestimonialPage() {
  await requireAdmin()
  return <><Link href="/testimonials" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All testimonials</Link><PageHeader title="New testimonial" description="Add a real student testimonial for the homepage." /><TestimonialForm action={createTestimonial} submitLabel="Create testimonial" /></>
}

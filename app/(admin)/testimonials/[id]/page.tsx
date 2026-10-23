import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/dal'
import { deleteTestimonial, updateTestimonial } from '@/lib/actions/testimonials'
import type { TestimonialRow } from '@/lib/testimonials'
import { Alert, Card, PageHeader } from '@/components/ui'
import { ConfirmButton } from '@/components/confirm-button'
import { TestimonialForm } from '../testimonial-form'

export const metadata: Metadata = { title: 'Edit testimonial' }
export default async function EditTestimonialPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin()
  const { id } = await params
  const { data, error } = await supabase.from('testimonials').select('*').eq('id', id).maybeSingle()
  if (error) return <Alert tone="error">Could not load the testimonial: {error.message}</Alert>
  if (!data) notFound()
  const testimonial = data as TestimonialRow
  return <><Link href="/testimonials" className="mb-4 inline-block text-xs font-bold uppercase tracking-wider text-brand">← All testimonials</Link><PageHeader title={`Testimonial from ${testimonial.name}`} description="Update this testimonial." /><TestimonialForm key={testimonial.updated_at} action={updateTestimonial.bind(null, id)} testimonial={testimonial} submitLabel="Save changes" /><Card className="mt-8 flex flex-col gap-3 border-red-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="font-semibold text-ink">Delete testimonial</h2><p className="text-sm text-muted">This removes the testimonial from the admin and the homepage.</p></div><form action={deleteTestimonial.bind(null, id)}><ConfirmButton variant="danger" message={`Delete the testimonial from “${testimonial.name}”?`}>Delete testimonial</ConfirmButton></form></Card></>
}

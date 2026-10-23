'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAdminForAction } from '../dal'
import { ENQUIRY_STATUSES } from '../enquiries'

const followUpSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES),
  notes: z.string().trim().max(5000, 'Keep notes under 5000 characters.').transform((value) => value || null),
})

// Only the follow-up fields can change; the database also restricts UPDATE to (status, notes).
export async function updateEnquiry(id: string, formData: FormData) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const parsed = followUpSchema.safeParse({ status: formData.get('status'), notes: formData.get('notes') ?? '' })
  if (!parsed.success) redirect(`/enquiries/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`)

  const { data, error } = await admin.supabase.from('enquiries').update(parsed.data).eq('id', id).select('id')
  revalidatePath('/enquiries')
  revalidatePath('/')
  if (error) redirect(`/enquiries/${id}?error=${encodeURIComponent(error.message)}`)
  if (!data || data.length === 0) redirect('/enquiries?error=Enquiry%20not%20found%20or%20not%20permitted')
  redirect(`/enquiries/${id}?saved=1`)
}

export async function deleteEnquiry(id: string) {
  const admin = await getAdminForAction()
  if (!admin) redirect('/login')
  const { data, error } = await admin.supabase.from('enquiries').delete().eq('id', id).select('id')
  revalidatePath('/enquiries')
  revalidatePath('/')
  if (error) redirect(`/enquiries/${id}?error=${encodeURIComponent(error.message)}`)
  redirect(data && data.length > 0 ? '/enquiries?saved=deleted' : '/enquiries?error=Enquiry%20not%20found%20or%20not%20permitted')
}

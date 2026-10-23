// Mirrors public.enquiries (supabase/migrations/001_enquiries.sql in naturals-beauty-web).
export type EnquiryRow = {
  id: string
  created_at: string
  name: string
  email: string
  phone: string | null
  message: string
  source: string
  status: EnquiryStatus
  notes: string | null
}

export const ENQUIRY_STATUSES = ['new', 'contacted', 'enrolled', 'closed'] as const
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

export const statusTone = { new: 'brand', contacted: 'warning', enrolled: 'success', closed: 'neutral' } as const

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value))

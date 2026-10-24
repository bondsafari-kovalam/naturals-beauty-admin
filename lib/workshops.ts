import { z } from 'zod'
import { PAGE_LINK_MESSAGE, isPageLink } from './image-url'

// Mirrors public.workshops and public.workshop_registrations
// (supabase/migrations/007_workshops.sql + 010_workshop_campaigns.sql in the website project).
export const WORKSHOP_STATUSES = ['draft', 'published', 'completed', 'cancelled'] as const
export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number]
export const workshopStatusTone = { draft: 'warning', published: 'success', completed: 'neutral', cancelled: 'danger' } as const

export type WorkshopRow = {
  id: string; title: string; slug: string; short_description: string | null; status: WorkshopStatus; total_seats: number | null; registration_open: boolean
  date: string; start_time: string; time_label: string; duration: string; category: string; description: string; image_url: string; location: string | null; seats: string | null; fee: string | null; highlights: string[]; audience: string[]; includes: string[]; agenda: { time: string; title: string }[]; trainer: { name: string; role: string; image: string } | null; faqs: [string, string][]; sort_order: number; is_published: boolean; created_at: string; updated_at: string
}

export const REGISTRATION_STATUSES = ['pending', 'confirmed', 'attended', 'cancelled'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]
export const registrationStatusTone = { pending: 'warning', confirmed: 'success', attended: 'brand', cancelled: 'danger' } as const

export type RegistrationRow = {
  id: string; workshop_id: string; full_name: string; phone: string; email: string | null; message: string | null
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null
  referrer: string | null; landing_path: string | null; status: RegistrationStatus; admin_notes: string | null; created_at: string; updated_at: string
}

/** "instagram / paid_social · nov-bridal" style label for where a registration came from. */
export function campaignLabel(row: Pick<RegistrationRow, 'utm_source' | 'utm_medium' | 'utm_campaign' | 'referrer'>) {
  if (row.utm_source) return [[row.utm_source, row.utm_medium].filter(Boolean).join(' / '), row.utm_campaign].filter(Boolean).join(' · ')
  if (row.referrer) {
    try { return `Referral: ${new URL(row.referrer).hostname.replace(/^www\./, '')}` } catch { /* not a URL */ }
  }
  return 'Direct / unknown'
}

const optionalText = (max: number, message?: string) => z.string().trim().max(max, message).transform((value) => value || null)
export const workshopSchema = z.object({
  title: z.string().trim().min(1, 'Enter the workshop title.').max(200, 'Keep the title under 200 characters.'),
  slug: z.string().trim().toLowerCase().min(1, 'Enter a campaign URL (it fills in from the title).').max(120, 'Keep the campaign URL under 120 characters.').regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only (e.g. bridal-makeup-masterclass).'),
  short_description: optionalText(300, 'Keep the short description under 300 characters.'),
  status: z.enum(WORKSHOP_STATUSES, { message: 'Choose a status.' }),
  total_seats: z.string().trim().transform((value, ctx) => {
    if (!value) return null
    const seats = Number(value)
    if (!Number.isInteger(seats) || seats < 1 || seats > 10000) { ctx.addIssue({ code: 'custom', message: 'Use a whole number from 1 to 10000, or leave empty for no limit.' }); return z.NEVER }
    return seats
  }),
  registration_open: z.boolean(),
  date: z.string().min(1, 'Choose the workshop date from the calendar.').regex(/^\d{4}-\d{2}-\d{2}$/, 'This date is not valid. Pick it again from the calendar.'), start_time: z.string().min(1, 'Choose the start time.').regex(/^\d{2}:\d{2}(:\d{2})?$/, 'This time is not valid. Pick it again, e.g. 10:00 AM.'), time_label: z.string().trim().min(1, 'Enter the time shown to visitors, e.g. 10:00 AM – 4:00 PM.').max(120, 'Keep this under 120 characters.'), duration: z.string().trim().min(1, 'Enter how long the workshop is, e.g. 1 day or 3 hours.').max(100, 'Keep this under 100 characters.'), category: z.string().trim().min(1, 'Enter a category, e.g. Makeup or Hair.').max(100, 'Keep this under 100 characters.'), description: z.string().trim().min(1, 'Write a short description of the workshop.').max(3000, 'Keep the description under 3000 characters.'), image_url: z.string().trim().min(1, 'Upload a workshop image.').regex(/^(\/|https:\/\/)/, 'Use a / path or an https:// URL.').refine((value) => !isPageLink(value), PAGE_LINK_MESSAGE), location: optionalText(200, 'Keep the location under 200 characters.'), seats: optionalText(100, 'Keep the seats text under 100 characters.'), fee: optionalText(100, 'Keep the fee under 100 characters.'), highlights: z.array(z.string().trim().min(1).max(300, 'Keep each line under 300 characters.')).max(30, 'Use at most 30 lines.'), audience: z.array(z.string().trim().min(1).max(300, 'Keep each line under 300 characters.')).max(20, 'Use at most 20 lines.'), includes: z.array(z.string().trim().min(1).max(300, 'Keep each line under 300 characters.')).max(20, 'Use at most 20 lines.'), agenda: z.array(z.object({ time: z.string().trim().min(1).max(50, 'Keep each time under 50 characters.'), title: z.string().trim().min(1).max(200, 'Keep each activity under 200 characters.') })).max(30, 'Use at most 30 agenda lines.'), trainer: z.object({ name: z.string().trim().min(1).max(200, 'Keep the trainer name under 200 characters.'), role: z.string().trim().min(1).max(200, 'Keep the trainer role under 200 characters.'), image: z.string().trim().min(1).regex(/^(\/|https:\/\/)/, 'Use a / path or an https:// URL.').refine((value) => !isPageLink(value), PAGE_LINK_MESSAGE) }).nullable(), faqs: z.array(z.tuple([z.string().trim().min(1).max(300, 'Keep each question under 300 characters.'), z.string().trim().min(1).max(1000, 'Keep each answer under 1000 characters.')])).max(20, 'Use at most 20 FAQs.'), sort_order: z.coerce.number({ message: 'Enter a number.' }).int('Use a whole number.').min(0, 'Use 0 or more.').max(100000, 'Use 100000 or less.'),
})

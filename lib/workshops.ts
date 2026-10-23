import { z } from 'zod'

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

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null)
export const workshopSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  slug: z.string().trim().toLowerCase().min(1, 'Enter a campaign URL.').max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only (e.g. bridal-makeup-masterclass).'),
  short_description: optionalText(300),
  status: z.enum(WORKSHOP_STATUSES),
  total_seats: z.string().trim().transform((value, ctx) => {
    if (!value) return null
    const seats = Number(value)
    if (!Number.isInteger(seats) || seats < 1 || seats > 10000) { ctx.addIssue({ code: 'custom', message: 'Use a whole number from 1 to 10000, or leave empty for no limit.' }); return z.NEVER }
    return seats
  }),
  registration_open: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.'), start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use a valid start time.'), time_label: z.string().trim().min(1).max(120), duration: z.string().trim().min(1).max(100), category: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(3000), image_url: z.string().trim().min(1, 'Enter an image path or URL.').regex(/^(\/|https:\/\/)/, 'Use a / path or an https:// URL.'), location: optionalText(200), seats: optionalText(100), fee: optionalText(100), highlights: z.array(z.string().trim().min(1).max(300)).max(30), audience: z.array(z.string().trim().min(1).max(300)).max(20), includes: z.array(z.string().trim().min(1).max(300)).max(20), agenda: z.array(z.object({ time: z.string().trim().min(1).max(50), title: z.string().trim().min(1).max(200) })).max(30), trainer: z.object({ name: z.string().trim().min(1).max(200), role: z.string().trim().min(1).max(200), image: z.string().trim().min(1).regex(/^(\/|https:\/\/)/, 'Use a / path or an https:// URL.') }).nullable(), faqs: z.array(z.tuple([z.string().trim().min(1).max(300), z.string().trim().min(1).max(1000)])).max(20), sort_order: z.coerce.number().int().min(0).max(100000),
})

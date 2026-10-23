import { getAdminForAction } from '@/lib/dal'
import { REGISTRATION_STATUSES, type RegistrationRow } from '@/lib/workshops'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cleanSearch = (value: string) => value.replace(/[,()%*\\]/g, ' ').trim().slice(0, 100)

// Quote every cell, and neutralise values that spreadsheets would run as formulas (CSV injection).
function csvCell(value: unknown) {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const admin = await getAdminForAction()
  if (!admin) return new Response('Not authorised', { status: 401 })

  const params = new URL(request.url).searchParams
  const q = cleanSearch(params.get('q') ?? '')
  const workshop = params.get('workshop') ?? ''
  const status = params.get('status') ?? ''

  let query = admin.supabase.from('workshop_registrations').select('*, workshop:workshops(title, date)')
  if (q) {
    const digits = q.replace(/\D/g, '')
    query = query.or([`full_name.ilike.%${q}%`, ...(digits.length >= 3 ? [`phone.ilike.%${digits}%`] : [])].join(','))
  }
  if (UUID.test(workshop)) query = query.eq('workshop_id', workshop)
  if (REGISTRATION_STATUSES.includes(status as never)) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(5000)
  if (error) return new Response(`Could not export registrations: ${error.message}`, { status: 500 })

  const header = ['Registered', 'Workshop', 'Workshop date', 'Name', 'Phone', 'Email', 'Message', 'Status', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term', 'Referrer', 'Landing page']
  const rows = (data as (RegistrationRow & { workshop: { title: string; date: string } | null })[]).map((r) => [
    r.created_at, r.workshop?.title, r.workshop?.date, r.full_name, r.phone, r.email, r.message, r.status,
    r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.referrer, r.landing_path,
  ])
  const csv = '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="workshop-registrations-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

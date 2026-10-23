import { getAdminForAction } from '@/lib/dal'
import { ENQUIRY_STATUSES, type EnquiryRow } from '@/lib/enquiries'

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
  const status = params.get('status') ?? ''

  let query = admin.supabase.from('enquiries').select('created_at, name, email, phone, message, source, status, notes')
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
  if (ENQUIRY_STATUSES.includes(status as never)) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(5000)
  if (error) return new Response(`Could not export enquiries: ${error.message}`, { status: 500 })

  const header = ['Received', 'Name', 'Email', 'Phone', 'Message', 'Source', 'Status', 'Notes']
  const rows = (data as Omit<EnquiryRow, 'id'>[]).map((e) => [e.created_at, e.name, e.email, e.phone, e.message, e.source, e.status, e.notes])
  const csv = '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="enquiries-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

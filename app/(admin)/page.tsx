import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/dal'
import { formatDateTime, statusTone, type EnquiryRow } from '@/lib/enquiries'
import { campaignLabel, registrationStatusTone, type RegistrationRow, type WorkshopRow } from '@/lib/workshops'
import { publicSiteUrl } from '@/lib/supabase/env'
import { Alert, Badge, Card, buttonClass } from '@/components/ui'
import { CopyButton } from '@/components/copy-button'

export const metadata: Metadata = { title: 'Dashboard' }

const IST = 'Asia/Kolkata'
const todayInIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date())
const shortDate = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`)
  return { day: new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: 'UTC' }).format(d), month: new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(d) }
}
// Time values for this request (kept outside the component body: rendering must stay pure).
function requestTimes() {
  const now = Date.now()
  return { today: todayInIndia(), nowIso: new Date(now).toISOString(), weekAgo: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() }
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: IST }).format(new Date()))
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

// Small line icons (the admin has no icon library).
const paths = {
  inbox: 'M4 13h4l2 3h4l2-3h4M5 5h14l1 8v6H4v-6z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M15.5 3.2a3.5 3.5 0 0 1 0 6.6',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14v15H5z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l4 4 10-10',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
}
function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof paths; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={paths[name]} /></svg>
}

function Panel({ title, href, linkLabel = 'View all', children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return <Card className="flex flex-col">
    <div className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {href && <Link href={href} className="text-xs font-bold uppercase tracking-wider text-brand hover:text-brand-deep">{linkLabel}</Link>}
    </div>
    {children}
  </Card>
}

type UpcomingWorkshop = Pick<WorkshopRow, 'id' | 'title' | 'slug' | 'date' | 'time_label' | 'status' | 'total_seats' | 'registration_open'>
type LatestRegistration = Pick<RegistrationRow, 'id' | 'full_name' | 'phone' | 'status' | 'created_at' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'referrer'> & { workshop: { title: string } | null }

export default async function DashboardPage() {
  const { supabase, email } = await requireAdmin()
  const { today, nowIso, weekAgo } = requestTimes()
  // GET with limit(0) instead of HEAD: HEAD responses hide errors such as a missing table.
  const count = (table: string) => supabase.from(table).select('id', { count: 'exact' }).limit(0)

  const [newEnquiries, weekEnquiries, latestEnquiries, pendingRegs, weekRegs, latestRegs, allRegs, upcoming, stalePublished, publishedCourses, draftCourses, livePosts, draftPosts] = await Promise.all([
    count('enquiries').eq('status', 'new'),
    count('enquiries').gte('created_at', weekAgo),
    supabase.from('enquiries').select('id, created_at, name, source, status').order('created_at', { ascending: false }).limit(5),
    count('workshop_registrations').eq('status', 'pending'),
    count('workshop_registrations').gte('created_at', weekAgo),
    supabase.from('workshop_registrations').select('id, full_name, phone, status, created_at, utm_source, utm_medium, utm_campaign, referrer, workshop:workshops(title)').order('created_at', { ascending: false }).limit(5),
    supabase.from('workshop_registrations').select('workshop_id, status'),
    supabase.from('workshops').select('id, title, slug, date, time_label, status, total_seats, registration_open').gte('date', today).in('status', ['published', 'draft']).order('date').limit(4),
    count('workshops').eq('status', 'published').lt('date', today),
    count('courses').eq('is_published', true),
    count('courses').eq('is_published', false),
    count('blog_posts').in('status', ['published', 'scheduled']).lte('published_at', nowIso),
    count('blog_posts').eq('status', 'draft'),
  ])

  // Tables that are not set up yet (migration not run) are shown as "—" rather than as errors.
  const missing = (error: { code?: string } | null) => error?.code === 'PGRST205' || error?.code === '42703'
  const problems = [
    newEnquiries.error && !missing(newEnquiries.error) && `Enquiries: ${newEnquiries.error.message}`,
    publishedCourses.error && !missing(publishedCourses.error) && `Courses: ${publishedCourses.error.message}`,
  ].filter(Boolean)

  const taken = new Map<string, number>()
  for (const row of allRegs.data ?? []) if (row.status !== 'cancelled') taken.set(row.workshop_id, (taken.get(row.workshop_id) ?? 0) + 1)
  const workshops = (upcoming.data ?? []) as UpcomingWorkshop[]
  const registrations = (latestRegs.data ?? []) as unknown as LatestRegistration[]

  const stats = [
    { label: 'New enquiries', value: newEnquiries.count, note: weekEnquiries.count != null ? `${weekEnquiries.count} in the last 7 days` : '', href: '/enquiries?status=new', icon: 'inbox' as const },
    { label: 'Registrations to confirm', value: pendingRegs.error ? null : pendingRegs.count, note: weekRegs.count != null ? `${weekRegs.count} new in the last 7 days` : 'Run 010_workshop_campaigns.sql', href: '/workshops/registrations?status=pending', icon: 'users' as const },
    { label: 'Upcoming workshops', value: upcoming.error ? null : workshops.filter((w) => w.status === 'published').length, note: workshops.some((w) => w.status === 'draft') ? 'plus drafts waiting to publish' : 'published and taking registrations', href: '/workshops', icon: 'calendar' as const },
    { label: 'Published courses', value: publishedCourses.count, note: draftCourses.count ? `${draftCourses.count} in drafts` : 'no drafts', href: '/courses?status=published', icon: 'book' as const },
    { label: 'Live blog posts', value: livePosts.error ? null : livePosts.count, note: draftPosts.count ? `${draftPosts.count} drafts` : 'no drafts', href: '/blog', icon: 'pen' as const },
  ]

  const todo = [
    newEnquiries.count ? { text: `Reply to ${newEnquiries.count} new enquir${newEnquiries.count === 1 ? 'y' : 'ies'}`, href: '/enquiries?status=new' } : null,
    pendingRegs.count ? { text: `Call and confirm ${pendingRegs.count} workshop registration${pendingRegs.count === 1 ? '' : 's'}`, href: '/workshops/registrations?status=pending' } : null,
    stalePublished.count ? { text: `Mark ${stalePublished.count} finished workshop${stalePublished.count === 1 ? '' : 's'} as completed`, href: '/workshops' } : null,
    workshops.some((w) => w.status === 'draft') ? { text: 'Publish the upcoming draft workshop so people can register', href: '/workshops' } : null,
    !upcoming.error && workshops.filter((w) => w.status === 'published').length < 2 ? { text: 'Plan the next workshop — fewer than two are scheduled', href: '/workshops/new' } : null,
    draftPosts.count ? { text: `Finish ${draftPosts.count} draft blog post${draftPosts.count === 1 ? '' : 's'}`, href: '/blog?status=draft' } : null,
  ].filter((item): item is { text: string; href: string } => Boolean(item))

  const actions = [
    { label: 'New workshop', href: '/workshops/new' },
    { label: 'New blog post', href: '/blog/new' },
    { label: 'New course', href: '/courses/new' },
    { label: 'Add faculty', href: '/faculty/new' },
  ]

  return (
    <>
      {/* Welcome */}
      <section className="relative mb-6 overflow-hidden rounded-xl bg-linear-to-br from-brand-deep via-brand-deep to-brand px-6 py-7 text-white sm:px-8">
        <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-champagne">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: IST }).format(new Date())}</p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl">{greeting()}.</h1>
            <p className="mt-1 text-sm text-white/75">Signed in as {email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => <Link key={action.href} href={action.href} className="inline-flex min-h-10 items-center gap-2 rounded bg-white/10 px-4 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"><Icon name="plus" className="h-4 w-4" />{action.label}</Link>)}
            <a href={publicSiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded bg-white px-4 text-xs font-bold uppercase tracking-wider text-brand-deep transition-colors hover:bg-lavender">Open website ↗</a>
          </div>
        </div>
      </section>

      {problems.length > 0 && <div className="mb-6"><Alert tone="error">Some data could not be loaded — {problems.join(' · ')}</Alert></div>}

      {/* Key numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group rounded-lg border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_12px_28px_#4d1f6814]">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender text-brand"><Icon name={stat.icon} /></span>
              <span className="text-brand opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>→</span>
            </div>
            <p className="mt-4 font-display text-4xl text-ink">{stat.value ?? '—'}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted">{stat.label}</p>
            {stat.note && <p className="mt-2 text-xs text-muted">{stat.note}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Upcoming workshops */}
        <Panel title="Upcoming workshops" href="/workshops" linkLabel="Manage">
          {upcoming.error ? <p className="px-5 py-8 text-center text-sm text-muted">Workshops are unavailable{missing(upcoming.error) ? ' — run 010_workshop_campaigns.sql in Supabase.' : '.'}</p>
            : workshops.length === 0 ? <div className="px-5 py-10 text-center"><p className="text-sm text-muted">No upcoming workshops.</p><Link href="/workshops/new" className={buttonClass('primary', 'mt-4')}>+ Plan a workshop</Link></div>
              : <ul>{workshops.map((workshop) => {
                const date = shortDate(workshop.date)
                const used = taken.get(workshop.id) ?? 0
                const percent = workshop.total_seats ? Math.min(100, Math.round((used / workshop.total_seats) * 100)) : 0
                return <li key={workshop.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                  <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-lavender py-2 text-brand-deep"><span className="font-display text-2xl leading-none">{date.day}</span><span className="mt-1 text-[10px] font-bold uppercase tracking-wider">{date.month}</span></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Link href={`/workshops/${workshop.id}`} className="truncate font-display text-lg text-ink hover:text-brand">{workshop.title}</Link>{workshop.status === 'draft' && <Badge tone="warning">Draft</Badge>}{workshop.status === 'published' && !workshop.registration_open && <Badge tone="neutral">Closed</Badge>}</div>
                    <p className="text-xs text-muted">{workshop.time_label} · <Link href={`/workshops/registrations?workshop=${workshop.id}`} className="text-brand hover:underline">{used} registered{workshop.total_seats ? ` of ${workshop.total_seats}` : ''}</Link></p>
                    {workshop.total_seats ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-lavender" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Seats filled"><div className={`h-full rounded-full ${percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${percent}%` }} /></div> : null}
                  </div>
                  {workshop.status === 'published' && workshop.slug && <CopyButton text={`${publicSiteUrl}/workshops/${workshop.slug}`} label="Copy link" className="min-h-8 px-3" />}
                </li>
              })}</ul>}
        </Panel>

        {/* To-do */}
        <Panel title="Needs attention">
          {todo.length === 0
            ? <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" /></span><p className="mt-3 text-sm text-muted">All caught up. Nothing needs your attention right now.</p></div>
            : <ul className="p-2">{todo.map((item) => <li key={item.text}><Link href={item.href} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-ink transition-colors hover:bg-soft"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Icon name="alert" className="h-4 w-4" /></span><span className="flex-1">{item.text}</span><span className="text-brand" aria-hidden>→</span></Link></li>)}</ul>}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Latest enquiries" href="/enquiries">
          {(latestEnquiries.data ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">{latestEnquiries.error ? 'Enquiries are unavailable.' : 'No enquiries yet.'}</p>
            : <ul>{(latestEnquiries.data as Pick<EnquiryRow, 'id' | 'created_at' | 'name' | 'source' | 'status'>[]).map((e) => (
              <li key={e.id} className="border-b border-line last:border-0">
                <Link href={`/enquiries/${e.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-soft">
                  <span className="min-w-0"><span className="block truncate text-sm text-ink">{e.name}</span><span className="text-xs text-muted">{formatDateTime(e.created_at)} · {e.source}</span></span>
                  <Badge tone={statusTone[e.status]}>{e.status}</Badge>
                </Link>
              </li>
            ))}</ul>}
        </Panel>

        <Panel title="Latest workshop registrations" href="/workshops/registrations">
          {registrations.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">{latestRegs.error ? (missing(latestRegs.error) ? 'Registrations start after 010_workshop_campaigns.sql is run in Supabase.' : 'Registrations are unavailable.') : 'No registrations yet. Share a workshop campaign link to get started.'}</p>
            : <ul>{registrations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 last:border-0">
                <span className="min-w-0"><span className="block truncate text-sm text-ink">{r.full_name} <a href={`tel:${r.phone}`} className="text-xs text-brand hover:underline">{r.phone}</a></span><span className="block truncate text-xs text-muted">{formatDateTime(r.created_at)} · {r.workshop?.title ?? 'Workshop'} · {campaignLabel(r)}</span></span>
                <Badge tone={registrationStatusTone[r.status]}>{r.status}</Badge>
              </li>
            ))}</ul>}
        </Panel>
      </div>
    </>
  )
}

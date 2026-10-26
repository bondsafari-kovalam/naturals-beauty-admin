'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ConfirmButton } from './confirm-button'

const items: { href: string; label: string; also?: string[] }[] = [
  { href: '/', label: 'Dashboard' },
  // Course categories (/categories) are reached from the Courses page, so Courses stays highlighted there.
  { href: '/courses', label: 'Courses', also: ['/categories'] },
  { href: '/blog', label: 'Blog' },
  { href: '/faculty', label: 'Faculty' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/enquiries', label: 'Enquiries' },
]

// Sidebar on desktop, collapsible menu on mobile. Navigation only: access is enforced on the server.
export function AdminNav({ email, signOutAction }: { email: string; signOutAction: () => Promise<void> }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const matches = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const isActive = (item: (typeof items)[number]) => matches(item.href) || (item.also ?? []).some(matches)

  return (
    <aside className="border-b border-line bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
        <Link href="/" className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
          <Image src="/naturals-asap-logo.png" alt="Alappuzha Naturals Beauty Academy, in partnership with ASAP Kerala" width={900} height={527} sizes="144px" priority className="h-11 w-auto lg:h-auto lg:w-36" />
          <span className="font-display text-2xl text-ink">Admin</span>
        </Link>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="admin-menu" className="rounded border border-line px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-deep lg:hidden">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      <div id="admin-menu" className={`${open ? 'block' : 'hidden'} px-3 pb-4 lg:block`}>
        <nav aria-label="Admin" className="flex flex-col gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={isActive(item) ? 'page' : undefined}
              className={`rounded px-3 py-2.5 text-sm transition-colors ${isActive(item) ? 'bg-brand-deep text-white' : 'text-ink hover:bg-lavender'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-line px-3 pt-4 lg:absolute lg:inset-x-3 lg:bottom-4">
          <p className="truncate text-xs text-muted" title={email}>{email}</p>
          <form action={signOutAction}>
            <ConfirmButton variant="primary" message="Sign out of the admin panel?" className="mt-2 text-xs font-bold uppercase tracking-wider text-brand hover:text-brand-deep">Sign out</ConfirmButton>
          </form>
        </div>
      </div>
    </aside>
  )
}

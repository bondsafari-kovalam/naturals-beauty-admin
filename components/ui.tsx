import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

// Small shared building blocks so every admin screen looks and behaves the same.

const buttonStyles = {
  primary: 'bg-brand-deep text-white hover:bg-brand',
  secondary: 'border border-line bg-white text-brand-deep hover:border-brand hover:text-brand',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-brand-deep hover:bg-lavender',
} as const

export function buttonClass(variant: keyof typeof buttonStyles = 'primary', extra = '') {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonStyles[variant]} ${extra}`
}

export const inputClass = 'w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none aria-[invalid=true]:border-red-400'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-line bg-white ${className}`}>{children}</div>
}

export function Field({ label, name, hint, error, required, children }: { label: string; name: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-xs font-bold uppercase tracking-wider text-ink">
        {label} {required ? <span className="text-brand">*</span> : <span className="font-normal normal-case tracking-normal text-muted">(optional)</span>}
      </label>
      {children}
      {error ? <p id={`${name}-error`} className="text-xs text-red-700">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'brand' | 'danger'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-soft text-muted',
    success: 'bg-emerald-50 text-emerald-800',
    warning: 'bg-amber-50 text-amber-800',
    brand: 'bg-lavender text-brand',
    danger: 'bg-red-50 text-red-700',
  }
  return <span className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>
}

export function Alert({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const tones = { success: 'border-emerald-200 bg-emerald-50 text-emerald-900', error: 'border-red-200 bg-red-50 text-red-800', info: 'border-line bg-lavender text-brand-deep' }
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </Card>
  )
}

// Page numbers to show: always first and last, plus the current page and its neighbours.
function pageList(page: number, pages: number): (number | 'gap')[] {
  const list: (number | 'gap')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p)
    else if (list.at(-1) !== 'gap') list.push('gap')
  }
  return list
}

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const base = 'inline-flex min-h-9 min-w-9 items-center justify-center rounded border px-3 text-sm'
  const link = `${base} border-line bg-white text-brand-deep hover:border-brand`
  const disabled = `${base} border-line bg-soft text-muted/60`
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
      <span>Showing {from}–{to} of {total}</span>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {page > 1 ? <Link className={link} href={href(page - 1)} aria-label="Previous page">‹ Prev</Link> : <span className={disabled} aria-hidden>‹ Prev</span>}
          {pageList(page, pages).map((p, i) => p === 'gap'
            ? <span key={`gap-${i}`} className="px-1" aria-hidden>…</span>
            : p === page
              ? <span key={p} aria-current="page" className={`${base} border-brand-deep bg-brand-deep font-semibold text-white`}>{p}</span>
              : <Link key={p} className={link} href={href(p)} aria-label={`Page ${p}`}>{p}</Link>)}
          {page < pages ? <Link className={link} href={href(page + 1)} aria-label="Next page">Next ›</Link> : <span className={disabled} aria-hidden>Next ›</span>}
        </div>
      )}
    </nav>
  )
}

export function SubmitButton({ children, pending, variant = 'primary', ...props }: ComponentProps<'button'> & { pending?: boolean; variant?: keyof typeof buttonStyles }) {
  return <button type="submit" disabled={pending} className={buttonClass(variant)} {...props}>{pending ? 'Saving…' : children}</button>
}

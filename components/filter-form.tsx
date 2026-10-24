'use client'

import { useEffect, useRef, useTransition, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// A list page's search/filter form that applies as soon as a dropdown changes (and shortly after typing
// stops in the search box), without a full page reload. Filters go into the URL, so a filtered list can be
// bookmarked or shared; changing a filter always goes back to page 1. The Filter button still works.
export function FilterForm({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const formRef = useRef<HTMLFormElement>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const [pending, startTransition] = useTransition()

  // Keep the fields in step with the URL (e.g. after "Clear filters" or the browser's back button).
  useEffect(() => {
    for (const field of formRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name], select[name]') ?? []) {
      // A dropdown without a URL value goes back to its first option (e.g. "All categories", "Newest first").
      const fallback = field instanceof HTMLSelectElement ? field.options[0]?.value ?? '' : ''
      if (field !== document.activeElement) field.value = searchParams.get(field.name) ?? fallback
    }
  }, [searchParams])

  useEffect(() => () => window.clearTimeout(typingTimer.current), [])

  function apply() {
    window.clearTimeout(typingTimer.current)
    if (!formRef.current) return
    const params = new URLSearchParams()
    for (const [name, value] of new FormData(formRef.current)) {
      if (typeof value === 'string' && value.trim()) params.set(name, value.trim())
    }
    const query = params.toString()
    if (query === searchParams.toString()) return
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  return <form ref={formRef} role="search" className={`${className ?? ''} transition-opacity ${pending ? 'opacity-60' : ''}`} aria-busy={pending}
    onSubmit={(event) => { event.preventDefault(); apply() }}
    onChange={(event) => {
      if (event.target instanceof HTMLSelectElement) apply()
      else { window.clearTimeout(typingTimer.current); typingTimer.current = window.setTimeout(apply, 400) }
    }}>
    {children}
  </form>
}

'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Tone = 'success' | 'error'
type Toast = { id: number; tone: Tone; message: string }

// Tiny module-level store so any client component can call toast() without a context provider.
let nextId = 0
const listeners = new Set<(toast: Toast) => void>()

export function toast(message: string, tone: Tone = 'success') {
  const item = { id: ++nextId, tone, message }
  listeners.forEach((listener) => listener(item))
}

// Server Actions redirect with ?saved=<key> or ?error=<message>; these map the keys per section.
const savedMessages: Record<string, Record<string, string>> = {
  courses: { created: 'Course created.', updated: 'Changes saved. The public website shows them within about 5 minutes.', deleted: 'Course deleted.', published: 'Course published.', unpublished: 'Course moved to drafts.' },
  categories: { created: 'Category added.', deleted: 'Category deleted.' },
  blog: { draft: 'Draft saved.', published: 'Post published. It is now live on the website.', scheduled: 'Post scheduled. It goes live automatically at the chosen time.', updated: 'Changes saved.', unpublished: 'Post moved to drafts and removed from the website.', deleted: 'Post deleted.', 'category-created': 'Category added.', 'category-deleted': 'Category deleted.' },
  faculty: { created: 'Faculty profile created.', updated: 'Faculty profile saved.', deleted: 'Faculty profile deleted.', published: 'Faculty profile published.', unpublished: 'Faculty profile moved to drafts.' },
  testimonials: { created: 'Testimonial created.', updated: 'Testimonial saved.', deleted: 'Testimonial deleted.', published: 'Testimonial published. It now shows on the homepage.', unpublished: 'Testimonial moved to drafts.' },
  workshops: { created: 'Workshop created.', updated: 'Workshop saved.', deleted: 'Workshop deleted.', published: 'Workshop published. Its campaign page is live.', unpublished: 'Workshop moved to drafts.', completed: 'Workshop marked as completed.', cancelled: 'Workshop marked as cancelled.', 'registration-updated': 'Registration updated.', 'registration-deleted': 'Registration deleted.' },
  enquiries: { deleted: 'Enquiry deleted.', '1': 'Follow-up saved.' },
}

const tones: Record<Tone, string> = {
  success: 'border-emerald-200 bg-white text-emerald-900 [&_.toast-dot]:bg-emerald-500',
  error: 'border-red-200 bg-white text-red-800 [&_.toast-dot]:bg-red-500',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const add = (item: Toast) => {
      setToasts((current) => [...current, item])
      window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== item.id)), item.tone === 'error' ? 7000 : 4000)
    }
    listeners.add(add)
    return () => { listeners.delete(add) }
  }, [])

  useEffect(() => {
    const saved = searchParams.get('saved')
    const error = searchParams.get('error')
    if (!saved && !error) return
    const section = pathname.split('/')[1] ?? ''
    const message = saved ? savedMessages[section]?.[saved] : null
    if (message) toast(message)
    if (error) toast(error, 'error')
    // Drop the one-off params so a refresh or back navigation doesn't replay the toast.
    const rest = new URLSearchParams(searchParams)
    rest.delete('saved')
    rest.delete('error')
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false })
  }, [pathname, searchParams, router])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:top-6">
      {toasts.map((t) => (
        <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={`toast-enter pointer-events-auto flex w-full items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-[0_16px_38px_#4d1f6824] sm:w-80 ${tones[t.tone]}`}>
          <span className="toast-dot mt-1.5 h-2 w-2 flex-none rounded-full" aria-hidden />
          <p className="flex-1">{t.message}</p>
          <button type="button" onClick={() => setToasts((current) => current.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="-mr-1 px-1 text-base leading-none text-muted hover:text-ink">×</button>
        </div>
      ))}
    </div>
  )
}

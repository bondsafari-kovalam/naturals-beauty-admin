import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions/auth'
import { buttonClass } from '@/components/ui'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Already signed in as an admin → straight to the dashboard.
  if (user) {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (isAdmin === true) redirect('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_#4d1f681f] lg:grid-cols-[1.1fr_1fr]">
        {/* Form side */}
        <section className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:py-16">
          {/* Logo moves to the brand panel on large screens. */}
          <Image src="/naturals-beauty-academy-logo.png" alt="Alappuzha Naturals Beauty Academy" width={1435} height={817} sizes="160px" priority className="mb-8 h-auto w-40 lg:hidden" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin portal</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Welcome <em className="text-brand">back.</em></h1>
          <p className="mt-2 text-sm text-muted">Sign in to manage courses, enquiries and site content.</p>
          <div className="mt-8">
            {user ? (
              <div className="flex flex-col gap-4 text-sm text-muted">
                <p>You are signed in as <strong className="text-ink">{user.email}</strong>, but this account does not have admin access.</p>
                <form action={signOut}><button type="submit" className={buttonClass('secondary', 'w-full')}>Sign out</button></form>
              </div>
            ) : (
              <LoginForm notice={error === 'not-authorized' ? 'Please sign in with an admin account.' : undefined} />
            )}
          </div>
          <p className="mt-8 border-t border-line pt-5 text-xs text-muted">Admin accounts are created by the academy owner. There is no public sign-up.</p>
        </section>

        {/* Brand side */}
        <aside className="relative order-first hidden flex-col items-center justify-center overflow-hidden bg-linear-to-br from-lavender via-soft to-[#efe2f5] p-12 lg:flex">
          <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-brand/10" />
          <div aria-hidden className="absolute -bottom-28 -left-20 size-80 rounded-full border-28 border-brand/5" />
          <Image src="/naturals-beauty-academy-logo.png" alt="Alappuzha Naturals Beauty Academy" width={1435} height={817} sizes="380px" priority className="relative h-auto w-full max-w-sm" />
          <div className="relative mt-10 h-px w-24 bg-champagne" />
          <p className="relative mt-5 text-center font-display text-lg italic text-brand-deep">Shaping beauty professionals in Alappuzha</p>
        </aside>
      </div>
    </main>
  )
}

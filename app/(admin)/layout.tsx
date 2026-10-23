import { Suspense } from 'react'
import { requireAdmin } from '@/lib/dal'
import { signOut } from '@/lib/actions/auth'
import { AdminNav } from '@/components/admin-nav'
import { Toaster } from '@/components/toaster'

// Shell for every admin page. The admin check here only gates the shell; each page and each
// Server Action calls the DAL again, because layouts don't re-render on client navigation.
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const { email } = await requireAdmin()
  return (
    <div className="min-h-screen">
      <AdminNav email={email} signOutAction={signOut} />
      <main className="px-4 py-8 sm:px-8 lg:ml-60 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <Suspense><Toaster /></Suspense>
    </div>
  )
}

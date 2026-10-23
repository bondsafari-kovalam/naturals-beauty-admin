import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

export type AdminSession = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; email: string }

// Data Access Layer: the single place that decides who is an admin.
// getUser() validates the session with Supabase Auth (never trust cookie contents alone),
// then public.is_admin() checks the admin_users table in the database.
async function loadAdmin(): Promise<AdminSession | 'signed-out' | 'not-admin'> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'signed-out'
  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  if (error || isAdmin !== true) return 'not-admin'
  return { supabase, userId: user.id, email: user.email ?? '' }
}

/** For pages and layouts (memoised per render). Redirects anyone who is not an admin. */
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const result = await loadAdmin()
  if (result === 'signed-out') redirect('/login')
  if (result === 'not-admin') redirect('/login?error=not-authorized')
  return result
})

/** For Server Actions and Route Handlers: re-checks on every call; returns null if not an admin. */
export async function getAdminForAction(): Promise<AdminSession | null> {
  const result = await loadAdmin()
  return typeof result === 'string' ? null : result
}

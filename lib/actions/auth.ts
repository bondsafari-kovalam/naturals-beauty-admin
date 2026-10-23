'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '../supabase/server'

export type LoginState = { error?: string; email?: string }

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  const email = String(formData.get('email') ?? '')
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  // Same message for unknown email and wrong password, so accounts can't be probed.
  if (error) return { error: 'Incorrect email or password.', email }

  // A valid account is not enough: it must be listed in admin_users.
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
  if (roleError || isAdmin !== true) {
    await supabase.auth.signOut()
    return { error: roleError ? 'Could not verify admin access. Please try again.' : 'This account does not have admin access.', email }
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

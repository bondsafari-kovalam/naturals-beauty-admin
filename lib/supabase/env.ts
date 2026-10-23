// Public Supabase settings (safe in the browser: the publishable key is limited by Row Level Security).
// This app never uses a secret / service-role key; admin rights come from RLS + public.is_admin().
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

export function getSupabaseEnv() {
  const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseKey && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(`Supabase is not configured. Add ${missing.join(' and ')} to .env.local (Supabase dashboard → Project Settings → API Keys), then restart the dev server.`)
  }
  return { url: supabaseUrl!, key: supabaseKey! }
}

export const publicSiteUrl = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '')

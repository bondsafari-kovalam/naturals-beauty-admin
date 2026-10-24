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

// Links shown in the admin (copy link, view on website, page addresses) always use the live domain unless
// NEXT_PUBLIC_PUBLIC_SITE_URL points somewhere else on purpose. A localhost value is ignored on Vercel, so a
// variable copied from .env.local can never put http://localhost:3000 links in the live admin.
const LIVE_SITE_URL = 'https://naturalsbeautyacademypro.com'
const configuredSiteUrl = 'https://naturalsbeautyacademypro.com'?.trim()
const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url)
export const publicSiteUrl = (configuredSiteUrl && !(process.env.VERCEL && isLocalUrl(configuredSiteUrl)) ? configuredSiteUrl : LIVE_SITE_URL).replace(/\/$/, '')

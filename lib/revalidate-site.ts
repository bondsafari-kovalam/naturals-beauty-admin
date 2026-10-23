import 'server-only'

// The public website is a separate Next.js app, so revalidatePath here can't clear its cache.
// Ask it to refresh through its /api/revalidate route instead. Failures are only logged:
// the save already succeeded, and the website still refreshes on its own within a few minutes.
export async function revalidatePublicSite() {
  const siteUrl = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!siteUrl || !secret) return
  try {
    const response = await fetch(new URL('/api/revalidate', siteUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) console.warn(`Website revalidation failed: HTTP ${response.status}`)
  } catch (error) {
    console.warn('Website revalidation failed:', error instanceof Error ? error.message : error)
  }
}

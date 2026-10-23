import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Naturals Admin', template: '%s | Naturals Admin' },
  description: 'Content management for Naturals Beauty Academy, Alappuzha.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body> before React loads; ignore those here only. */}
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  )
}

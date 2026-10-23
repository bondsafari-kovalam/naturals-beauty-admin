'use client'

import { useState } from 'react'
import { buttonClass } from './ui'

// Copies text (e.g. a workshop campaign URL) to the clipboard and confirms for a moment.
export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Older browsers / non-secure contexts: fall back to a prompt the admin can copy from.
      window.prompt('Copy this link:', text)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <button type="button" onClick={copy} className={buttonClass('secondary', `shrink-0 ${className}`)} aria-live="polite">{copied ? 'Copied ✓' : label}</button>
}

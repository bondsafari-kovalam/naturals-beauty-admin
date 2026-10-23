'use client'

import { useId, useState } from 'react'
import { imageSrc } from '@/lib/blog'
import { buttonClass, inputClass } from '@/components/ui'
import { uploadImageFile } from './upload-image'

type Props = {
  name: string
  value: string
  onChange: (value: string) => void
  onUploadingChange?: (uploading: boolean) => void
  publicSiteUrl: string
  error?: string
  emptyHint: string
}

// Upload / replace / remove an image. The stored value is the permanent Supabase Storage URL
// (or a website path such as /kerala-makeup.jpg), never a temporary browser blob URL.
export function ImageField({ name, value, onChange, onUploadingChange, publicSiteUrl, error, emptyHint }: Props) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const message = uploadError || error

  async function upload(file: File) {
    setUploadError('')
    setUploading(true)
    onUploadingChange?.(true)
    try {
      onChange(await uploadImageFile(file))
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'Could not upload the image.')
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={value} />
      <div className="relative flex aspect-[1200/630] w-full items-center justify-center overflow-hidden rounded border border-dashed border-line bg-soft">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={imageSrc(value, publicSiteUrl)} alt="" className="h-full w-full object-cover" />
          : <p className="px-6 text-center text-sm text-muted">{emptyHint}</p>}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85" role="status">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-brand" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-deep">Uploading…</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={inputId} className={buttonClass('secondary', `cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`)}>
          {value ? 'Replace image' : 'Upload image'}
        </label>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={uploading}
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
        {value && <button type="button" className={buttonClass('ghost')} disabled={uploading} onClick={() => onChange('')}>Remove</button>}
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Or use an image link</summary>
        <input className={`${inputClass} mt-2`} value={value} placeholder="https://… or /image-in-website-public-folder.jpg" aria-label="Image link"
          onChange={(event) => onChange(event.target.value.trim())} />
      </details>
      {message && <p className="text-xs text-red-700" role="alert">{message}</p>}
    </div>
  )
}

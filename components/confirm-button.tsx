'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { buttonClass } from './ui'

// A submit button that asks for confirmation in a modal first (used for delete / unpublish).
// Must be rendered inside the <form> it submits.
// `className` restyles only the trigger (e.g. the text-link Sign out); the dialog is unchanged.
export function ConfirmButton({ message, children, variant = 'danger', className }: { message: string; children: ReactNode; variant?: 'danger' | 'secondary' | 'primary'; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { pending } = useFormStatus()
  const wasPending = useRef(false)

  // Close once the action finishes (e.g. unpublish keeps the row on screen).
  useEffect(() => {
    if (wasPending.current && !pending) dialogRef.current?.close()
    wasPending.current = pending
  }, [pending])

  return (
    <>
      <button type="button" className={className ?? buttonClass(variant)} onClick={() => dialogRef.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(event) => { if (event.target === event.currentTarget && !pending) event.currentTarget.close() }}
        onCancel={(event) => { if (pending) event.preventDefault() }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-md border border-line bg-white p-0 text-left text-ink shadow-[0_24px_60px_#29242d33] backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          {variant === 'danger' && (
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-lg text-red-600" aria-hidden>!</span>
          )}
          <p id={titleId} className="font-display text-xl leading-snug">{message}</p>
          {variant === 'danger' && <p className="mt-2 text-sm text-muted">This can’t be undone.</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" autoFocus disabled={pending} className={buttonClass('secondary')} onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={buttonClass(variant === 'danger' ? 'destructive' : 'primary')}>
              {pending ? 'Please wait…' : children}
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}

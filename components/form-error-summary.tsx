'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Alert } from './ui'

const NONE: Record<string, string> = {}

// Errors for the form it sits in, shown at the top. Before the form is sent, every required field (a <Field required>)
// is checked in the browser: if any is empty, nothing is saved, the page goes back to the top and the empty fields
// are listed. Errors from the server after saving are listed the same way. Clicking an item jumps to that field.
// `fieldIds` maps an error key to its input's id when they differ (e.g. trainer → trainer_image).
export function FormErrorSummary({ message, fieldErrors = NONE, fieldIds = NONE }: { message?: string; fieldErrors?: Record<string, string>; fieldIds?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [missing, setMissing] = useState<Record<string, string> | null>(null)
  const errors = missing ?? fieldErrors
  const shownMessage = missing ? 'Please fill in the required fields.' : message
  const keys = Object.keys(errors)
  const idOf = (key: string) => fieldIds[key] ?? key

  useEffect(() => {
    const form = ref.current?.closest('form')
    if (!form) return
    // Capture phase, so an incomplete form never reaches the form's own submit handler or its server action.
    const checkRequired = (event: SubmitEvent) => {
      const empty: Record<string, string> = {}
      for (const wrapper of form.querySelectorAll<HTMLElement>('[data-required-field]')) {
        const id = wrapper.dataset.requiredField!
        const control = form.querySelector(`#${CSS.escape(id)}`)
        if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) || control.disabled) continue
        const isEmpty = control instanceof HTMLInputElement && control.type === 'file' ? !control.files?.length : !control.value.trim()
        if (isEmpty) { empty[id] = 'This field is required.'; control.setAttribute('aria-invalid', 'true') }
      }
      if (Object.keys(empty).length === 0) { setMissing(null); return }
      event.preventDefault()
      event.stopImmediatePropagation()
      setMissing(empty)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    // Clear the red border once a required field is filled in.
    const clearFilled = (event: Event) => {
      const control = event.target as HTMLInputElement
      if (control.closest?.('[data-required-field]') && (control.type === 'file' ? control.files?.length : control.value.trim())) control.removeAttribute('aria-invalid')
    }
    form.addEventListener('submit', checkRequired, true)
    form.addEventListener('input', clearFilled)
    form.addEventListener('change', clearFilled)
    return () => {
      form.removeEventListener('submit', checkRequired, true)
      form.removeEventListener('input', clearFilled)
      form.removeEventListener('change', clearFilled)
    }
  }, [])

  // Errors returned by the server after saving: back to the top as well.
  useEffect(() => {
    if (message) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [message, fieldErrors])

  return <div ref={ref} className="empty:hidden">
    {shownMessage && <Alert tone="error">
      <p className="font-semibold">{keys.length > 0 ? `Please fix ${keys.length === 1 ? 'this field' : `these ${keys.length} fields`} and save again:` : shownMessage}</p>
      {keys.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">
        {keys.map((key) => <li key={key}>
          <a href={`#${idOf(key)}`} className="underline underline-offset-2 hover:text-red-950" onClick={(event) => {
            const field = document.getElementById(idOf(key))
            if (!field) return
            event.preventDefault()
            field.scrollIntoView({ behavior: 'smooth', block: 'center' })
            field.focus({ preventScroll: true })
          }}><strong><FieldLabel id={idOf(key)} fallback={key.replace(/_/g, ' ')} /></strong></a>: {errors[key]}
        </li>)}
      </ul>}
    </Alert>}
  </div>
}

const noSubscribe = () => () => {}

// The visible label of a field, read from its <label for>; the label also holds " *" or "(optional)", so only
// its first text is used.
function FieldLabel({ id, fallback }: { id: string; fallback: string }) {
  const label = useSyncExternalStore(noSubscribe, () => document.querySelector(`label[for="${CSS.escape(id)}"]`)?.firstChild?.textContent?.trim() ?? '', () => '')
  return <>{label || fallback}</>
}

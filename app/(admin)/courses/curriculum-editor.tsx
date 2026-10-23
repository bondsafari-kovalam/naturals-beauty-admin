'use client'

import { useState } from 'react'
import type { CourseModule } from '@/lib/courses'
import { buttonClass, inputClass } from '@/components/ui'

type EditableModule = { key: number; heading: string; topics: string; note?: string }

// Edits the curriculum as a list of modules (heading + one topic per line) and submits it as JSON.
export function CurriculumEditor({ initial, error }: { initial: CourseModule[]; error?: string }) {
  const [modules, setModules] = useState<EditableModule[]>(() => initial.map((m, i) => ({ key: i, heading: m.heading, topics: m.topics.join('\n'), note: m.note })))
  const [nextKey, setNextKey] = useState(initial.length)

  const update = (key: number, patch: Partial<EditableModule>) => setModules((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)))
  const move = (index: number, direction: -1 | 1) => setModules((list) => {
    const target = index + direction
    if (target < 0 || target >= list.length) return list
    const copy = [...list]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    return copy
  })

  const json = JSON.stringify(modules.map((m) => ({
    heading: m.heading.trim(),
    topics: m.topics.split('\n').map((t) => t.trim()).filter(Boolean),
    ...(m.note?.trim() ? { note: m.note.trim() } : {}),
  })))

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-ink">Curriculum <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></legend>
      <p className="text-xs text-muted">Each module has a heading and its topics, one per line. Shown on the course page under “What you will study”.</p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <input type="hidden" name="curriculum" value={json} />
      {modules.length === 0 && <p className="rounded border border-dashed border-line bg-soft px-4 py-6 text-center text-sm text-muted">No modules yet. The course page will say “Please contact the academy for the detailed curriculum”.</p>}
      {modules.map((module, index) => (
        <div key={module.key} className="rounded border border-line bg-soft p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">Module {index + 1}</span>
            <div className="flex gap-1">
              <button type="button" className={buttonClass('ghost', 'min-h-8 px-2')} onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move module ${index + 1} up`}>↑</button>
              <button type="button" className={buttonClass('ghost', 'min-h-8 px-2')} onClick={() => move(index, 1)} disabled={index === modules.length - 1} aria-label={`Move module ${index + 1} down`}>↓</button>
              <button type="button" className={buttonClass('danger', 'min-h-8 px-2')} onClick={() => setModules((list) => list.filter((m) => m.key !== module.key))}>Remove</button>
            </div>
          </div>
          <label className="sr-only" htmlFor={`module-heading-${module.key}`}>Module heading</label>
          <input id={`module-heading-${module.key}`} className={inputClass} placeholder="Module heading, e.g. Theory of Skin" value={module.heading} onChange={(e) => update(module.key, { heading: e.target.value })} />
          <label className="sr-only" htmlFor={`module-topics-${module.key}`}>Topics, one per line</label>
          <textarea id={`module-topics-${module.key}`} className={`${inputClass} mt-2 min-h-28`} placeholder={'One topic per line'} value={module.topics} onChange={(e) => update(module.key, { topics: e.target.value })} />
        </div>
      ))}
      <button type="button" className={buttonClass('secondary', 'self-start')} onClick={() => { setModules((list) => [...list, { key: nextKey, heading: '', topics: '' }]); setNextKey(nextKey + 1) }}>+ Add module</button>
    </fieldset>
  )
}

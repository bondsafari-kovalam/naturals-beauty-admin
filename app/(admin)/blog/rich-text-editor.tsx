'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, Node, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextAlign } from '@tiptap/extension-text-align'
import { Youtube, isValidYoutubeUrl } from '@tiptap/extension-youtube'
import { buttonClass, inputClass } from '@/components/ui'
import { uploadImageFile } from './upload-image'

// An image with alt text and an optional caption, stored as <figure><img><figcaption></figure>.
const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: '' }, caption: { default: '' } }
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (element) => {
          const img = element.querySelector('img')
          return img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt') ?? '', caption: element.querySelector('figcaption')?.textContent ?? '' } : false
        },
      },
      { tag: 'img[src]', getAttrs: (element) => ({ src: element.getAttribute('src'), alt: element.getAttribute('alt') ?? '' }) },
    ]
  },
  renderHTML({ node }) {
    const img = ['img', { src: node.attrs.src, alt: node.attrs.alt }] as const
    return node.attrs.caption ? ['figure', {}, img, ['figcaption', {}, node.attrs.caption]] : ['figure', {}, img]
  },
})

type DialogKind = 'link' | 'image' | 'youtube' | null
type ImageDraft = { src: string; alt: string; caption: string }

export function RichTextEditor({ value, onChange, onUploadingChange, invalid }: { value: string; onChange: (html: string) => void; onUploadingChange?: (uploading: boolean) => void; invalid?: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: null, target: null } },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Figure,
    ],
    content: value,
    editorProps: { attributes: { class: 'blog-prose min-h-[420px] px-5 py-4 focus:outline-none', 'aria-label': 'Article content', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  })

  return (
    <div className={`overflow-hidden rounded border bg-white ${invalid ? 'border-red-400' : 'border-line'}`}>
      {editor ? <Toolbar editor={editor} onUploadingChange={onUploadingChange} /> : <div className="h-[52px] border-b border-line bg-soft" />}
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor, onUploadingChange }: { editor: Editor; onUploadingChange?: (uploading: boolean) => void }) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const block = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
  const chain = () => editor.chain().focus()
  const figureSelected = editor.isActive('figure')

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-soft px-2 py-2" role="toolbar" aria-label="Formatting">
        <select aria-label="Text style" value={block} className="h-8 rounded border border-line bg-white px-2 text-xs"
          onChange={(event) => {
            const level = Number(event.target.value.slice(1)) as 1 | 2 | 3
            if (event.target.value === 'p') chain().setParagraph().run()
            else chain().setHeading({ level }).run()
          }}>
          <option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <Divider />
        <Tool label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><b>B</b></Tool>
        <Tool label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><i className="font-display">I</i></Tool>
        <Tool label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><span className="underline">U</span></Tool>
        <Divider />
        <Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>• ≡</Tool>
        <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>1.≡</Tool>
        <Tool label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>❝</Tool>
        <Tool label="Divider line" onClick={() => chain().setHorizontalRule().run()}>―</Tool>
        <Divider />
        {(['left', 'center', 'right', 'justify'] as const).map((align) => (
          <Tool key={align} label={`Align ${align}`} active={editor.isActive({ textAlign: align })} onClick={() => chain().setTextAlign(align).run()}>
            <AlignIcon align={align} />
          </Tool>
        ))}
        <Divider />
        <Tool label={editor.isActive('link') ? 'Edit link' : 'Add link'} active={editor.isActive('link')} onClick={() => setDialog('link')}>Link</Tool>
        {editor.isActive('link') && <Tool label="Remove link" onClick={() => chain().extendMarkRange('link').unsetLink().run()}>Unlink</Tool>}
        <Tool label={figureSelected ? 'Edit image' : 'Insert image'} active={figureSelected} onClick={() => setDialog('image')}>{figureSelected ? 'Edit image' : 'Image'}</Tool>
        <Tool label="Embed YouTube video" onClick={() => setDialog('youtube')}>YouTube</Tool>
        <Divider />
        <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>↶</Tool>
        <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>↷</Tool>
      </div>
      {dialog === 'link' && <LinkDialog editor={editor} onClose={() => setDialog(null)} />}
      {dialog === 'image' && <ImageDialog editor={editor} onUploadingChange={onUploadingChange} onClose={() => setDialog(null)} />}
      {dialog === 'youtube' && <YoutubeDialog editor={editor} onClose={() => setDialog(null)} />}
    </>
  )
}

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active ?? undefined} disabled={disabled} onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded px-2 text-xs font-semibold transition-colors disabled:opacity-40 ${active ? 'bg-brand-deep text-white' : 'text-ink hover:bg-lavender'}`}>
      {children}
    </button>
  )
}

const Divider = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden />

function AlignIcon({ align }: { align: 'left' | 'center' | 'right' | 'justify' }) {
  const rows = align === 'justify' ? [[2, 14], [2, 14], [2, 14]] : align === 'center' ? [[2, 14], [4, 12], [3, 13]] : align === 'right' ? [[2, 14], [6, 14], [4, 14]] : [[2, 14], [2, 10], [2, 12]]
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>{rows.map(([x1, x2], i) => <line key={i} x1={x1} x2={x2} y1={4 + i * 4} y2={4 + i * 4} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />)}</svg>
}

// Small modal used for links, images and videos.
function EditorDialog({ title, onClose, onSubmit, submitLabel, busy, children }: { title: string; onClose: () => void; onSubmit: () => void; submitLabel: string; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return (
    <dialog ref={ref} onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault() }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-md border border-line bg-white p-0 text-left text-ink shadow-[0_24px_60px_#29242d33] backdrop:bg-ink/40">
      {/* Not a <form>: this dialog sits inside the post form, and nested forms are invalid HTML. */}
      <div className="flex flex-col gap-4 p-6" onKeyDown={(event) => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') { event.preventDefault(); if (!busy) onSubmit() } }}>
        <p className="font-display text-xl">{title}</p>
        {children}
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass('secondary')} disabled={busy} onClick={() => ref.current?.close()}>Cancel</button>
          <button type="button" className={buttonClass()} disabled={busy} onClick={onSubmit}>{submitLabel}</button>
        </div>
      </div>
    </dialog>
  )
}

function DialogField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">{label}{children}{hint && <span className="font-normal normal-case tracking-normal text-muted">{hint}</span>}</label>
}

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [href, setHref] = useState<string>(editor.getAttributes('link').href ?? '')
  const [newTab, setNewTab] = useState(editor.getAttributes('link').target === '_blank')
  const [error, setError] = useState('')
  const save = () => {
    const url = href.trim()
    if (!url) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); onClose(); return }
    if (!/^(https?:\/\/|mailto:|tel:|\/)/.test(url)) { setError('Start the link with https://, /, mailto: or tel:'); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: newTab ? '_blank' : null }).run()
    onClose()
  }
  return (
    <EditorDialog title="Link" submitLabel="Save link" onClose={onClose} onSubmit={save}>
      <DialogField label="Address"><input autoFocus className={inputClass} value={href} placeholder="https://… or /courses" onChange={(e) => { setHref(e.target.value); setError('') }} /></DialogField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} /> Open in a new tab</label>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </EditorDialog>
  )
}

function ImageDialog({ editor, onClose, onUploadingChange }: { editor: Editor; onClose: () => void; onUploadingChange?: (uploading: boolean) => void }) {
  const editing = editor.isActive('figure')
  const current = editing ? (editor.getAttributes('figure') as ImageDraft) : null
  const [draft, setDraft] = useState<ImageDraft>({ src: current?.src ?? '', alt: current?.alt ?? '', caption: current?.caption ?? '' })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function upload(file: File) {
    setError('')
    setUploading(true)
    onUploadingChange?.(true)
    try {
      const src = await uploadImageFile(file)
      setDraft((d) => ({ ...d, src }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the image.')
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
    }
  }

  const save = () => {
    if (!/^https:\/\//.test(draft.src)) { setError('Upload an image or paste an https:// image link.'); return }
    if (!draft.alt.trim()) { setError('Describe the image (alt text) for screen readers and search engines.'); return }
    const attrs = { src: draft.src, alt: draft.alt.trim(), caption: draft.caption.trim() }
    if (editing) editor.chain().focus().updateAttributes('figure', attrs).run()
    else editor.chain().focus().insertContent({ type: 'figure', attrs }).run()
    onClose()
  }

  return (
    <EditorDialog title={editing ? 'Edit image' : 'Insert image'} submitLabel={editing ? 'Save image' : 'Insert image'} busy={uploading} onClose={onClose} onSubmit={save}>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded border border-dashed border-line bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {uploading ? <span className="text-xs font-bold uppercase tracking-wider text-brand-deep" role="status">Uploading…</span> : draft.src ? <img src={draft.src} alt="" className="h-full w-full object-contain" /> : <span className="text-sm text-muted">No image yet</span>}
      </div>
      <DialogField label="Upload" hint="JPG, PNG, WebP or AVIF. Large images are compressed automatically.">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} className="text-sm font-normal normal-case tracking-normal"
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file) }} />
      </DialogField>
      <DialogField label="Or image link"><input className={inputClass} value={draft.src} placeholder="https://…" onChange={(e) => setDraft({ ...draft, src: e.target.value.trim() })} /></DialogField>
      <DialogField label="Alt text"><input className={inputClass} value={draft.alt} maxLength={300} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} /></DialogField>
      <DialogField label="Caption (optional)"><input className={inputClass} value={draft.caption} maxLength={300} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} /></DialogField>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </EditorDialog>
  )
}

function YoutubeDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const save = () => {
    if (!isValidYoutubeUrl(url.trim())) { setError('Paste a YouTube video link (youtube.com/watch?v=… or youtu.be/…).'); return }
    editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run()
    onClose()
  }
  return (
    <EditorDialog title="Embed YouTube video" submitLabel="Embed video" onClose={onClose} onSubmit={save}>
      <DialogField label="YouTube link"><input autoFocus className={inputClass} value={url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => { setUrl(e.target.value); setError('') }} /></DialogField>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </EditorDialog>
  )
}

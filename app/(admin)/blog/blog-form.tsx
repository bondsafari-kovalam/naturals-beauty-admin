'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react'
import { checkBlogSlug, type SlugCheck } from '@/lib/actions/blog'
import type { CourseFormState } from '@/lib/actions/courses'
import { DEFAULT_AUTHOR, effectiveStatus, formatDate, slugify, statusTone, toIstInput, type BlogPostRow } from '@/lib/blog'
import { Badge, Card, Field, buttonClass, inputClass } from '@/components/ui'
import { BlogPreview } from './blog-preview'
import { ImageField } from './image-field'
import { RichTextEditor } from './rich-text-editor'
import { FormErrorSummary } from '@/components/form-error-summary'

type Props = {
  action: (prev: CourseFormState, formData: FormData) => Promise<CourseFormState>
  post?: BlogPostRow
  categories: { id: string; name: string }[]
  knownTags: string[]
  publicSiteUrl: string
}

export function BlogForm({ action, post, categories, knownTags, publicSiteUrl }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.fieldErrors ?? {}
  const v = state.values
  const invalid = (name: string) => (errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {})

  // Controlled fields (they drive the slug, counters, Google preview and article preview).
  const [title, setTitle] = useState(post?.title ?? '')
  const [slug, setSlug] = useState(post?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(post))
  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>(null)
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [categoryId, setCategoryId] = useState(post?.category_id ?? '')
  const [tags, setTags] = useState<string[]>(post?.tags ?? [])
  const [author, setAuthor] = useState(post?.author_name ?? DEFAULT_AUTHOR)
  const [image, setImage] = useState(post?.featured_image ?? '')
  const [imageAlt, setImageAlt] = useState(post?.image_alt ?? '')
  const [imageCaption, setImageCaption] = useState(post?.image_caption ?? '')
  const [content, setContent] = useState(post?.content ?? '')
  const [publishAt, setPublishAt] = useState(toIstInput(post?.published_at ?? null))
  const [lastReviewed, setLastReviewed] = useState(post?.last_reviewed_at ?? '')
  const [uploads, setUploads] = useState(0)
  const [dirty, setDirty] = useState(false)
  const submitting = useRef(false)
  const previewRef = useRef<HTMLDialogElement>(null)

  const status = post ? effectiveStatus(post) : 'draft'
  const isLive = post?.status !== undefined && post.status !== 'draft'
  const uploading = uploads > 0
  const trackUpload = (busy: boolean) => setUploads((n) => n + (busy ? 1 : -1))
  const touch = () => { if (!dirty) setDirty(true) }

  // The action failed: the page didn't navigate, so allow the unsaved-changes warning again.
  useEffect(() => { if (state.error) submitting.current = false }, [state])

  // Warn before leaving with unsaved changes: closing the tab, reloading, or clicking a link in the admin.
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!submitting.current) event.preventDefault() }
    const click = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a[href]')
      if (!link || submitting.current || link.getAttribute('target') === '_blank' || event.defaultPrevented) return
      if (!window.confirm('You have unsaved changes. Leave this page and lose them?')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true) }
  }, [dirty])

  async function verifySlug(value: string) {
    if (!value) { setSlugCheck(null); return }
    setSlugCheck(await checkBlogSlug(value, post?.id))
  }

  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? ''
  const pageUrl = `${publicSiteUrl}/blog/${slug || 'your-post'}`

  return (
    <form action={formAction} onChange={touch} onSubmit={() => { submitting.current = true }} className="flex flex-col gap-6 pb-28" noValidate>
      <FormErrorSummary message={state.error} fieldErrors={state.fieldErrors} />

      <Section title="Basic information" description="What the post is about and where it lives on the website.">
        <div className="md:col-span-2">
          <Field label="Blog title" name="title" required error={errors.title}>
            <input id="title" name="title" className={inputClass} value={title} maxLength={200} {...invalid('title')}
              onChange={(e) => { setTitle(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)) }}
              onBlur={() => { if (!slugEdited) void verifySlug(slug) }} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="URL slug" name="slug" required error={errors.slug ?? (slugCheck && !slugCheck.available ? slugCheck.message : undefined)}
            hint={slugCheck?.available ? `✓ ${slugCheck.message} ${pageUrl}` : `Page address: ${pageUrl}`}>
            <input id="slug" name="slug" className={inputClass} value={slug} maxLength={120} {...invalid('slug')}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); setSlugCheck(null) }}
              onBlur={() => void verifySlug(slug)} />
          </Field>
          {isLive && post && slug !== post.slug && <p className="mt-1 text-xs text-amber-700">Changing the slug of a published post breaks existing links to it.</p>}
        </div>
        <div className="md:col-span-2">
          <Field label="Short description / excerpt" name="excerpt" required error={errors.excerpt} hint={`Shown on blog cards and under the title. ${excerpt.length}/500`}>
            <textarea id="excerpt" name="excerpt" className={`${inputClass} min-h-20`} value={excerpt} maxLength={500} {...invalid('excerpt')} onChange={(e) => setExcerpt(e.target.value)} />
          </Field>
        </div>
        <Field label="Category" name="category_id" required error={errors.category_id} hint="Manage the list on Blog → Categories.">
          <select id="category_id" name="category_id" className={inputClass} value={categoryId} {...invalid('category_id')} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="" disabled>Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Author" name="author_name" error={errors.author_name}>
          <input id="author_name" name="author_name" className={inputClass} value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Tags" name="tags" error={errors.tags} hint="Press Enter or comma to add a tag. Up to 20.">
            <TagInput tags={tags} onChange={(next) => { setTags(next); touch() }} suggestions={knownTags} />
          </Field>
        </div>
      </Section>

      <Section title="Featured image" description="Cover image for the article and blog cards. Recommended size: 1200 × 630 pixels.">
        <div className="md:col-span-2">
          <ImageField name="featured_image" value={image} onChange={(value) => { setImage(value); touch() }} onUploadingChange={trackUpload} publicSiteUrl={publicSiteUrl} error={errors.featured_image}
            emptyHint="No cover image yet. JPG, PNG, WebP or AVIF; large images are compressed automatically." />
        </div>
        <Field label="Image alt text" name="image_alt" required={Boolean(image)} error={errors.image_alt} hint="Describe the image for screen readers and search engines.">
          <input id="image_alt" name="image_alt" className={inputClass} value={imageAlt} maxLength={300} {...invalid('image_alt')} onChange={(e) => setImageAlt(e.target.value)} />
        </Field>
        <Field label="Image caption" name="image_caption" error={errors.image_caption}>
          <input id="image_caption" name="image_caption" className={inputClass} value={imageCaption} maxLength={300} onChange={(e) => setImageCaption(e.target.value)} />
        </Field>
      </Section>

      <Section title="Article" description="Write the full article. Use headings to split it into sections; images can have alt text and captions.">
        <div className="md:col-span-2">
          <input type="hidden" name="content" value={content} />
          <RichTextEditor value={content} onChange={(html) => { setContent(html); touch() }} onUploadingChange={trackUpload} invalid={Boolean(errors.content)} />
          {errors.content && <p id="content-error" className="mt-1.5 text-xs text-red-700">{errors.content}</p>}
        </div>
      </Section>

      <Section title="Publishing" description="Drafts are never visible on the website. Scheduled posts go live automatically at the chosen time (India time).">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-ink">Current status</span>
          <span><Badge tone={statusTone[status]}>{status}</Badge>{post?.published_at && status !== 'draft' && <span className="ml-2 text-xs text-muted">{status === 'scheduled' ? 'Goes live' : 'Published'} {formatDate(post.published_at, true)}</span>}</span>
        </div>
        <label className="flex items-center gap-3 self-end text-sm">
          <input type="checkbox" name="is_featured" defaultChecked={v ? v.is_featured === 'on' : post?.is_featured ?? false} className="h-4 w-4 accent-brand-deep" />
          <span><strong className="text-ink">Featured post</strong><span className="block text-xs text-muted">Highlighted at the top of the blog page.</span></span>
        </label>
        <Field label="Publish date and time" name="published_at" error={errors.published_at} hint="Needed to schedule. For “Publish now”, leave empty (or keep the original date).">
          <input id="published_at" name="published_at" type="datetime-local" className={inputClass} value={publishAt} {...invalid('published_at')} onChange={(e) => setPublishAt(e.target.value)} />
        </Field>
        <Field label="Last reviewed date" name="last_reviewed_at" error={errors.last_reviewed_at} hint="Shown on the article when set (useful for skincare advice).">
          <input id="last_reviewed_at" name="last_reviewed_at" type="date" className={inputClass} value={lastReviewed} onChange={(e) => setLastReviewed(e.target.value)} />
        </Field>
        {post && <p className="text-xs text-muted md:col-span-2">Created {formatDate(post.created_at, true)} · Last updated {formatDate(post.updated_at, true)}</p>}
      </Section>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted" role="status">{uploading ? 'Uploading image…' : pending ? 'Saving…' : dirty ? 'Unsaved changes' : ''}</span>
          <Link href="/blog" className={buttonClass('ghost')}>Cancel</Link>
          <button type="button" className={buttonClass('secondary')} onClick={() => previewRef.current?.showModal()}>Preview</button>
          {isLive
            ? <>
                <ActionButton intent="draft" variant="secondary" disabled={pending || uploading}>Unpublish to draft</ActionButton>
                {status === 'scheduled' && <ActionButton intent="publish" variant="secondary" disabled={pending || uploading}>Publish now</ActionButton>}
                <ActionButton intent="update" disabled={pending || uploading}>{status === 'scheduled' ? 'Save schedule' : 'Save changes'}</ActionButton>
              </>
            : <>
                <ActionButton intent="draft" variant="secondary" disabled={pending || uploading}>Save draft</ActionButton>
                <ActionButton intent="schedule" variant="secondary" disabled={pending || uploading || !publishAt}>Schedule</ActionButton>
                <ActionButton intent="publish" disabled={pending || uploading}>Publish now</ActionButton>
              </>}
        </div>
      </div>

      <dialog ref={previewRef} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close() }}
        className="m-auto h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-4xl rounded-md border border-line bg-white p-0 shadow-[0_24px_60px_#29242d33] backdrop:bg-ink/40">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-soft px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-deep">Preview · not saved yet</p>
          <button type="button" className={buttonClass('secondary', 'min-h-8 px-3')} onClick={() => previewRef.current?.close()}>Close</button>
        </div>
        <div className="p-6">
          <BlogPreview publicSiteUrl={publicSiteUrl} post={{
            title, excerpt, categoryName, image, imageAlt, imageCaption, content, author, tags,
            publishedLabel: publishAt ? formatDate(new Date(`${publishAt}:00+05:30`).toISOString()) : 'Not published',
            lastReviewedLabel: lastReviewed ? formatDate(`${lastReviewed}T12:00:00+05:30`) : undefined,
          }} />
        </div>
      </dialog>
    </form>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">{children}</div>
    </Card>
  )
}

function ActionButton({ intent, variant = 'primary', disabled, children }: { intent: string; variant?: 'primary' | 'secondary'; disabled?: boolean; children: ReactNode }) {
  return <button type="submit" name="intent" value={intent} disabled={disabled} className={buttonClass(variant)}>{children}</button>
}

function TagInput({ tags, onChange, suggestions }: { tags: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, ' ').replace(/,/g, '').slice(0, 40)
    if (tag && tags.length < 20 && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...tags, tag])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-line bg-white px-2 py-1.5 focus-within:border-brand">
      <input type="hidden" name="tags" value={tags.join(',')} />
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-lavender py-1 pl-3 pr-1 text-xs text-brand-deep">
          {tag}
          <button type="button" aria-label={`Remove tag ${tag}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white" onClick={() => onChange(tags.filter((t) => t !== tag))}>×</button>
        </span>
      ))}
      <input id="tags" list="blog-tag-suggestions" value={draft} placeholder={tags.length ? '' : 'e.g. sunscreen, acne care'} className="min-w-32 flex-1 border-0 bg-transparent py-1 text-sm focus:outline-none"
        onChange={(e) => { if (e.target.value.endsWith(',')) add(e.target.value); else setDraft(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft) }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => { if (draft.trim()) add(draft) }} />
      <datalist id="blog-tag-suggestions">{suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  )
}

import { imageSrc } from '@/lib/blog'

export type PreviewPost = {
  title: string
  excerpt: string
  categoryName: string
  image: string
  imageAlt: string
  imageCaption: string
  content: string
  publishedLabel: string
  lastReviewedLabel?: string
  author: string
  tags: string[]
}

// Approximates the public article page (fonts, widths, prose styles) so admins can check a post before publishing.
// `content` must already be sanitised (server) or come straight from the editor's schema (client).
export function BlogPreview({ post, publicSiteUrl }: { post: PreviewPost; publicSiteUrl: string }) {
  return (
    <article className="mx-auto max-w-3xl px-1 py-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand">
        {[post.categoryName || 'Uncategorised', post.publishedLabel].filter(Boolean).join(' · ')}
      </p>
      <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">{post.title || 'Untitled post'}</h1>
      {post.excerpt && <p className="mt-4 font-display text-xl leading-relaxed text-muted">{post.excerpt}</p>}
      <p className="mt-4 text-xs text-muted">
        {post.author && <>By <strong className="text-ink">{post.author}</strong></>}
        {post.lastReviewedLabel && <> · Last reviewed {post.lastReviewedLabel}</>}
      </p>
      {post.image && (
        <figure className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc(post.image, publicSiteUrl)} alt={post.imageAlt} className="aspect-[1200/630] w-full rounded-md bg-lavender object-cover" />
          {post.imageCaption && <figcaption className="mt-2 text-center text-xs text-muted">{post.imageCaption}</figcaption>}
        </figure>
      )}
      {post.content
        ? <div className="blog-prose mt-10" dangerouslySetInnerHTML={{ __html: post.content }} />
        : <p className="mt-10 text-sm italic text-muted">No article content yet.</p>}
      {post.tags.length > 0 && <p className="mt-10 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="rounded-full bg-lavender px-3 py-1 text-xs text-brand-deep">#{tag}</span>)}</p>}
    </article>
  )
}

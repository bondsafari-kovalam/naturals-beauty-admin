import 'server-only'
import sanitizeHtml from 'sanitize-html'

// Allowlist for blog article HTML. Keep in sync with the website's lib/blog-html.ts, which runs
// the same rules again before rendering (defence in depth: the database could be edited directly).
const YOUTUBE_EMBED = /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\/[\w-]{6,20}(\?[\w=&;-]*)?$/
const ALIGN = { 'text-align': [/^(left|right|center|justify)$/] }

const options: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'figure', 'img', 'figcaption', 'div', 'iframe', 'code', 'pre'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'allow', 'title'],
    div: ['data-youtube-video'],
    p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], li: ['style'],
  },
  allowedStyles: { '*': ALIGN },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'],
  // Only YouTube embed URLs survive; any other iframe is removed entirely.
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !YOUTUBE_EMBED.test(frame.attribs.src ?? ''),
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs }),
  },
}

export function sanitizeBlogHtml(html: string) {
  return sanitizeHtml(html, options).trim()
}

/** Plain text of an HTML fragment (for "is the article empty?" checks and word counts). */
export function htmlToText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim()
}

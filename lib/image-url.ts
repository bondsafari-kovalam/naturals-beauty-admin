// Links to these sites open a web page (a Drive file, an Instagram post…), not the image file itself, so they
// always show as a broken image on the website. Admins are asked to upload the image instead.
const PAGE_HOSTS = [
  'drive.google.com', 'docs.google.com', 'photos.google.com', 'photos.app.goo.gl', 'www.google.com', 'google.com',
  'instagram.com', 'www.instagram.com', 'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'fb.watch',
  'pinterest.com', 'www.pinterest.com', 'in.pinterest.com', 'pin.it', 'youtube.com', 'www.youtube.com', 'youtu.be',
  'wa.me', 'web.whatsapp.com', 'onedrive.live.com', '1drv.ms', 'dropbox.com', 'www.dropbox.com',
]

export const PAGE_LINK_MESSAGE = 'This is a link to a web page, not to an image file, so it would show as a broken image. Download the image and upload it here instead.'

/** True for links that open a page on Drive, Instagram, Facebook, Google Photos and similar sites. */
export function isPageLink(value: string | null) {
  if (!value?.startsWith('https://')) return false
  try {
    return PAGE_HOSTS.includes(new URL(value).hostname.toLowerCase())
  } catch {
    return false
  }
}

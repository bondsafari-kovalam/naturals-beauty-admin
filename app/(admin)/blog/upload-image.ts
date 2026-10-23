import { uploadBlogImage } from '@/lib/actions/blog'
import { IMAGE_TYPES, compressImage } from '@/lib/compress-image'

/** Validates, compresses if needed and uploads an image to Supabase Storage. Returns its public URL. */
export async function uploadImageFile(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG, WebP or AVIF image.')
  const upload = await compressImage(file)
  const formData = new FormData()
  formData.set('file', upload)
  const result = await uploadBlogImage(formData)
  if (!result.url) throw new Error(result.error ?? 'Could not upload the image.')
  return result.url
}

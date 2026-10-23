// Browser-only helper: shrinks images over the 5 MB upload limit (Supabase bucket limit) to WebP.

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const COMPRESSED_IMAGE_TARGET = MAX_IMAGE_SIZE - 100 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
}

export async function compressImage(file: File) {
  if (file.size <= MAX_IMAGE_SIZE) return file

  const bitmap = await createImageBitmap(file)
  try {
    const maxDimension = 2400
    let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not prepare this image for upload.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      const quality = Math.max(0.35, 0.85 - attempt * 0.08)
      const blob = await canvasBlob(canvas, quality)
      if (blob && blob.size <= COMPRESSED_IMAGE_TARGET) {
        const name = file.name.replace(/\.[^.]+$/, '') || 'course-image'
        return new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: Date.now() })
      }

      scale *= 0.8
    }
  } finally {
    bitmap.close()
  }

  throw new Error('This image could not be compressed below 5 MB.')
}

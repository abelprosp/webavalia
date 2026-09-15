export const MAX_PHOTOS = 5
export const MAX_SIZE_MB = 2
// Leave room for base64 encoding and the remaining evaluation fields in the 8 MB request.
export const MAX_TOTAL_MB = 5
export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
]

export function validatePhotoFiles(photos: { file: File }[]): string | null {
  if (photos.length > MAX_PHOTOS)
    return `Selecione no máximo ${MAX_PHOTOS} fotos.`
  let total = 0
  for (const { file } of photos) {
    if (!ACCEPTED_TYPES.includes(file.type))
      return 'Use imagens JPG, PNG ou WebP.'
    if (file.size === 0) return 'A imagem está vazia.'
    if (file.size > MAX_SIZE_MB * 1024 * 1024)
      return `Cada foto deve ter até ${MAX_SIZE_MB} MB.`
    total += file.size
  }
  if (total > MAX_TOTAL_MB * 1024 * 1024)
    return `As fotos devem somar até ${MAX_TOTAL_MB} MB.`
  return null
}

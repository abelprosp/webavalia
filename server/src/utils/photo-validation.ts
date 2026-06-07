const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const MAX_TOTAL_BYTES = 6 * 1024 * 1024

const MAGIC: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/jpg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
}

type PhotoInput = { mimeType: string; data: string }

function decodeBase64(data: string): Buffer | null {
  const normalized = data.includes(',') ? data.split(',')[1]! : data
  if (!/^[A-Za-z0-9+/=\s]+$/.test(normalized)) return null

  try {
    return Buffer.from(normalized.replace(/\s/g, ''), 'base64')
  } catch {
    return null
  }
}

function matchesMagic(buffer: Buffer, mimeType: string) {
  const patterns = MAGIC[mimeType]
  if (!patterns) return false

  return patterns.some((pattern) =>
    pattern.every((byte, index) => buffer[index] === byte)
  )
}

export function validatePhotos(photos?: PhotoInput[]) {
  if (!photos?.length) return { ok: true as const }

  let totalBytes = 0

  for (const [index, photo] of photos.entries()) {
    const buffer = decodeBase64(photo.data)
    if (!buffer?.length) {
      return {
        ok: false as const,
        message: `Foto ${index + 1} inválida.`,
      }
    }

    if (buffer.length > MAX_PHOTO_BYTES) {
      return {
        ok: false as const,
        message: `Foto ${index + 1} excede 2 MB.`,
      }
    }

    if (!matchesMagic(buffer, photo.mimeType)) {
      return {
        ok: false as const,
        message: `Foto ${index + 1} não corresponde ao formato informado.`,
      }
    }

    totalBytes += buffer.length
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    return {
      ok: false as const,
      message: 'Tamanho total das fotos excede 6 MB.',
    }
  }

  return { ok: true as const }
}

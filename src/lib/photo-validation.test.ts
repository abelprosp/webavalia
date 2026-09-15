import { describe, expect, it } from 'vitest'
import { validatePhotoFiles } from './photo-validation'

describe('photo upload limits', () => {
  const photo = (size: number, type = 'image/jpeg') => ({
    file: new File([new Uint8Array(size)], 'foto.jpg', { type }),
  })
  it('accepts five small supported photos', () => {
    expect(
      validatePhotoFiles(Array.from({ length: 5 }, () => photo(10)))
    ).toBeNull()
  })
  it('rejects too many, oversized, empty and unsupported files', () => {
    expect(
      validatePhotoFiles(Array.from({ length: 6 }, () => photo(10)))
    ).not.toBeNull()
    expect(validatePhotoFiles([photo(2 * 1024 * 1024 + 1)])).not.toBeNull()
    expect(validatePhotoFiles([photo(0)])).not.toBeNull()
    expect(validatePhotoFiles([photo(10, 'text/html')])).not.toBeNull()
  })
  it('leaves room for base64 overhead in the API request', () => {
    expect(
      validatePhotoFiles(
        Array.from({ length: 3 }, () => photo(2 * 1024 * 1024))
      )
    ).not.toBeNull()
  })
})

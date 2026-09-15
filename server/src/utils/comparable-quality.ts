import type { NbrHomogenizedComparable } from '../types/evaluation.js'

/** Preserve identity parameters; remove only known tracking parameters. */
export function canonicalListingUrl(value?: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function filterDuplicateComparables(items: NbrHomogenizedComparable[]) {
  const seen = new Set<string>()
  const unique: NbrHomogenizedComparable[] = []
  for (const item of items) {
    const url = canonicalListingUrl(item.link)
    // Without a source URL, do not assume similar descriptions refer to the same property.
    if (url && seen.has(url)) continue
    if (url) seen.add(url)
    unique.push(item)
  }
  return { unique, duplicatesRemoved: items.length - unique.length }
}

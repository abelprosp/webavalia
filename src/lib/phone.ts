export function phoneDigits(value: string) {
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 11)
}

export function formatBrazilianPhone(value: string) {
  const digits = phoneDigits(value)

  if (digits.length <= 2) return digits
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

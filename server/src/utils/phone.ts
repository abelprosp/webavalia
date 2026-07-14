function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function normalizePhone(value: string) {
  let digits = digitsOnly(value)

  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2)
  }

  return digits.slice(0, 11)
}

export function validateBrazilianPhone(value: string) {
  const digits = normalizePhone(value)

  if (digits.length < 10 || digits.length > 11) {
    return {
      ok: false as const,
      message: 'Informe um telefone válido com DDD.',
    }
  }

  const ddd = Number(digits.slice(0, 2))
  if (ddd < 11 || ddd > 99) {
    return {
      ok: false as const,
      message: 'DDD inválido.',
    }
  }

  if (digits.length === 11 && digits[2] !== '9') {
    return {
      ok: false as const,
      message: 'Informe um celular válido com o nono dígito.',
    }
  }

  return { ok: true as const, digits }
}

export function toE164Brazil(digits: string) {
  return `+55${digits}`
}

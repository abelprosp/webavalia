function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value)
}

function isValidCpf(cpf: string) {
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let check = (sum * 10) % 11
  if (check === 10) check = 0
  if (check !== Number(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  check = (sum * 10) % 11
  if (check === 10) check = 0
  return check === Number(cpf[10])
}

function isValidCnpj(cnpj: string) {
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cnpj[i]) * weights1[i]!
  let check = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (check !== Number(cnpj[12])) return false

  sum = 0
  for (let i = 0; i < 13; i++) sum += Number(cnpj[i]) * weights2[i]!
  check = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return check === Number(cnpj[13])
}

export function normalizeDocument(value: string) {
  return digitsOnly(value)
}

export function validateDocumentForAccountType(
  accountType: 'pf' | 'pj',
  document: string
) {
  const digits = normalizeDocument(document)

  if (accountType === 'pf') {
    if (!isValidCpf(digits)) {
      return { ok: false as const, message: 'CPF inválido.' }
    }
    return { ok: true as const, digits }
  }

  if (!isValidCnpj(digits)) {
    return { ok: false as const, message: 'CNPJ inválido.' }
  }
  return { ok: true as const, digits }
}

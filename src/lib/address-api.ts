import { api } from './api'

export type CepLookupResult = {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
}

export function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function composeAddressFromCep(
  parts: CepLookupResult & { streetNumber?: string }
) {
  const streetLine = parts.street
    ? parts.streetNumber
      ? `${parts.street}, ${parts.streetNumber}`
      : parts.street
    : ''
  const cityLine = [parts.neighborhood, parts.city].filter(Boolean).join(', ')
  const tail = [cityLine, parts.state].filter(Boolean).join(' - ')
  return [streetLine, tail].filter(Boolean).join(' — ')
}

export async function lookupCep(cep: string) {
  const digits = cep.replace(/\D/g, '')
  const { data } = await api.get<CepLookupResult>(`/address/cep/${digits}`)
  return data
}

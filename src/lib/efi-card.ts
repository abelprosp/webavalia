import EfiPay from 'payment-token-efi'

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'elo'
  | 'hipercard'
  | 'undefined'
  | 'unsupported'

export type PaymentTokenResult = {
  paymentToken: string
  cardMask: string
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const err = error as {
      error_description?: string
      error?: string
      message?: string
    }
    return err.error_description ?? err.error ?? err.message
  }
  return undefined
}

export async function detectCardBrand(cardNumber: string): Promise<CardBrand> {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 6) return 'undefined'

  try {
    const brand =
      await EfiPay.CreditCard.setCardNumber(digits).verifyCardBrand()
    return brand as CardBrand
  } catch {
    return 'undefined'
  }
}

export async function generateEfiPaymentToken(input: {
  payeeCode: string
  environment: 'sandbox' | 'production'
  brand: string
  number: string
  cvv: string
  expirationMonth: string
  expirationYear: string
  holderName: string
  holderDocument: string
}): Promise<PaymentTokenResult> {
  try {
    const result = await EfiPay.CreditCard.setAccount(input.payeeCode)
      .setEnvironment(input.environment)
      .setCreditCardData({
        brand: input.brand,
        number: input.number.replace(/\D/g, ''),
        cvv: input.cvv.replace(/\D/g, ''),
        expirationMonth: input.expirationMonth.padStart(2, '0'),
        expirationYear: input.expirationYear,
        holderName: input.holderName.trim(),
        holderDocument: input.holderDocument.replace(/\D/g, ''),
        reuse: true,
      })
      .getPaymentToken()

    if ('error' in result && result.error) {
      throw new Error(
        result.error_description || result.error || 'Falha ao tokenizar cartão.'
      )
    }

    const tokenResult = result as {
      payment_token: string
      card_mask: string
    }

    if (!tokenResult.payment_token) {
      throw new Error('Não foi possível gerar o token do cartão.')
    }

    return {
      paymentToken: tokenResult.payment_token,
      cardMask: tokenResult.card_mask,
    }
  } catch (error) {
    throw new Error(
      getErrorMessage(error) ?? 'Falha ao tokenizar cartão com a Efí.',
      { cause: error }
    )
  }
}

export function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim()
}

export function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function parseExpiry(value: string) {
  const [month = '', year = ''] = value.split('/')
  const fullYear = year.length === 2 ? `20${year}` : year
  return { month, year: fullYear }
}

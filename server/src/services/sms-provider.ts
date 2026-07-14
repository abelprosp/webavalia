import { config } from '../config.js'
import { toE164Brazil } from '../utils/phone.js'

export type SendSmsInput = {
  toDigits: string
  body: string
}

export type SmsProvider = {
  sendSms(input: SendSmsInput): Promise<void>
}

export function isTwilioConfigured() {
  return Boolean(
    config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.fromNumber
  )
}

class TwilioSmsProvider implements SmsProvider {
  async sendSms(input: SendSmsInput) {
    const { accountSid, authToken, fromNumber } = config.twilio
    const to = toE164Brazil(input.toDigits)
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      'base64'
    )

    const body = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: input.body,
    })

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    )

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Twilio SMS falhou (${response.status}): ${detail}`)
    }
  }
}

class ConsoleSmsProvider implements SmsProvider {
  async sendSms(input: SendSmsInput) {
    console.log(
      `[dev] SMS para ${toE164Brazil(input.toDigits)}: ${input.body}`
    )
  }
}

let provider: SmsProvider | null = null

export function getSmsProvider(): SmsProvider {
  if (provider) return provider

  if (isTwilioConfigured()) {
    provider = new TwilioSmsProvider()
    return provider
  }

  if (config.isProduction) {
    throw new Error('Provedor SMS não configurado.')
  }

  provider = new ConsoleSmsProvider()
  return provider
}

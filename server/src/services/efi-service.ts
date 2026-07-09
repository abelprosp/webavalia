import EfiPay from 'sdk-node-apis-efi'
import { config } from '../config.js'
import { PRICING } from '../constants/pricing.js'
import { pool } from '../db/pool.js'

type EfiOptions = {
  sandbox: boolean
  client_id: string
  client_secret: string
  certificate?: string
  cert_base64?: boolean
  validate_mtls?: boolean
  cache?: boolean
}

// O pacote exporta a classe via default, mas os tipos ESM do SDK são inconsistentes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EfiClient = any

const EfiPayClient = EfiPay as unknown as new (options: EfiOptions) => EfiClient

let client: EfiClient | null = null

function assertEfiCredentials() {
  if (!config.efi.clientId || !config.efi.clientSecret) {
    throw new Error(
      'Pagamentos indisponíveis. Configure EFI_CLIENT_ID e EFI_CLIENT_SECRET no server/.env'
    )
  }
}

function assertPixConfigured() {
  assertEfiCredentials()
  if (!config.efi.certificate || config.efi.certificateSource === 'missing') {
    throw new Error(
      'PIX indisponível. Certificado Efí não encontrado. Configure EFI_CERTIFICATE=./certs/producao-927103-Avaliimobe.p12 (ou base64 com EFI_CERTIFICATE_BASE64=true).'
    )
  }
  if (!config.efi.pixKey) {
    throw new Error(
      'PIX indisponível. Configure EFI_PIX_KEY no server/.env'
    )
  }
}

function getEfiClient(): EfiClient {
  assertEfiCredentials()

  if (!client) {
    const options: EfiOptions = {
      sandbox: config.efi.sandbox,
      client_id: config.efi.clientId,
      client_secret: config.efi.clientSecret,
      cache: true,
      validate_mtls: config.efi.validateMtls,
    }

    // Certificado .p12 obrigatório para API Pix; também usado pelo SDK nas demais APIs
    if (config.efi.certificate) {
      options.certificate = config.efi.certificate
      options.cert_base64 = config.efi.certificateBase64
    }

    client = new EfiPayClient(options)
  }

  return client
}

function formatEfiError(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error

  if (!error || typeof error !== 'object') {
    return 'Erro na API Efí Bank.'
  }

  const err = error as {
    error_description?: string
    errorDescription?: string
    mensagem?: string
    message?: string
    error?: string
    nome?: string
  }

  return (
    err.error_description ??
    err.errorDescription ??
    err.mensagem ??
    err.message ??
    err.error ??
    err.nome ??
    'Erro na API Efí Bank.'
  )
}

async function withEfi<T>(fn: (efi: EfiClient) => Promise<T>): Promise<T> {
  try {
    return await fn(getEfiClient())
  } catch (error) {
    const message = formatEfiError(error)
    console.error('[efi]', message, error)
    throw new Error(message)
  }
}

const PLAN_SETTING_KEY = 'efi_evaluation_plan_id'

export async function ensureEvaluationPlanId() {
  if (config.efi.planId) return config.efi.planId

  const stored = await pool.query<{ value: { planId?: number } }>(
    `SELECT value FROM platform_settings WHERE key = $1`,
    [PLAN_SETTING_KEY]
  )
  const existingId = stored.rows[0]?.value?.planId
  if (existingId) return existingId

  const created = await withEfi((efi) =>
    efi.createPlan(
      {},
      {
        name: PRICING.evaluationPlan.label,
        interval: 1,
      }
    )
  ) as {
    data: { plan_id: number }
  }

  const planId = created.data.plan_id
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = NOW()`,
    [PLAN_SETTING_KEY, JSON.stringify({ planId })]
  )

  return planId
}

export type EfiBillingAddress = {
  street: string
  number: string
  neighborhood: string
  zipcode: string
  city: string
  state: string
  complement?: string
}

export type EfiCustomerInput = {
  name: string
  email: string
  cpfCnpj: string
  phoneNumber: string
  birth: string
  companyName?: string | null
}

function buildCustomerPayload(customer: EfiCustomerInput) {
  const digits = customer.cpfCnpj.replace(/\D/g, '')
  const phone = customer.phoneNumber.replace(/\D/g, '')

  if (digits.length === 14) {
    return {
      email: customer.email,
      phone_number: phone,
      birth: customer.birth,
      juridical_person: {
        corporate_name: customer.companyName || customer.name,
        cnpj: digits,
      },
    }
  }

  return {
    name: customer.name,
    cpf: digits,
    email: customer.email,
    phone_number: phone,
    birth: customer.birth,
  }
}

export type EfiSubscriptionResult = {
  code: number
  data: {
    subscription_id: number
    status: string
    charge?: {
      id: number
      status: string
      parcel: number
      total: number
    }
    total: number
    payment: string
  }
}

export async function createCardSubscription(input: {
  planId: number
  amountCents: number
  itemName: string
  customId: string
  paymentToken: string
  customer: EfiCustomerInput
  billingAddress: EfiBillingAddress
}): Promise<EfiSubscriptionResult> {
  const notificationUrl = config.efi.notificationUrl

  return withEfi((efi) =>
    efi.createOneStepSubscription(
      { id: input.planId },
      {
        items: [
          {
            name: input.itemName,
            value: input.amountCents,
            amount: 1,
          },
        ],
        metadata: {
          custom_id: input.customId,
          ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        },
        payment: {
          credit_card: {
            customer: buildCustomerPayload(input.customer),
            billing_address: {
              street: input.billingAddress.street,
              number: input.billingAddress.number,
              neighborhood: input.billingAddress.neighborhood,
              zipcode: input.billingAddress.zipcode.replace(/\D/g, ''),
              city: input.billingAddress.city,
              state: input.billingAddress.state.toUpperCase(),
              ...(input.billingAddress.complement
                ? { complement: input.billingAddress.complement }
                : {}),
            },
            payment_token: input.paymentToken,
          },
        },
      }
    )
  ) as Promise<EfiSubscriptionResult>
}

export type EfiPixChargeResult = {
  txid: string
  status: string
  brCode: string
  brCodeBase64: string
  expiresAt: string
  locationId: number
}

export async function createPixCharge(input: {
  amountCents: number
  payerName: string
  cpfCnpj: string
  description: string
  orderId: string
}): Promise<EfiPixChargeResult> {
  assertPixConfigured()

  const digits = input.cpfCnpj.replace(/\D/g, '')
  const value = (input.amountCents / 100).toFixed(2)

  const charge = (await withEfi((efi) =>
    efi.pixCreateImmediateCharge(
      {},
      {
        calendario: { expiracao: 3600 },
        devedor: {
          nome: input.payerName,
          ...(digits.length === 14 ? { cnpj: digits } : { cpf: digits }),
        },
        valor: { original: value },
        chave: config.efi.pixKey,
        solicitacaoPagador: input.description.slice(0, 140),
        infoAdicionais: [
          { nome: 'Pedido', valor: input.orderId.slice(0, 50) },
          { nome: 'Produto', valor: 'Creditos de leads' },
        ],
      }
    )
  )) as {
    txid: string
    status: string
    calendario: { expiracao: number }
    loc: { id: number }
    pixCopiaECola?: string
  }

  const qr = (await withEfi((efi) =>
    efi.pixGenerateQRCode({ id: charge.loc.id })
  )) as {
    qrcode: string
    imagemQrcode: string
  }

  const expiresAt = new Date(
    Date.now() + Number(charge.calendario.expiracao) * 1000
  ).toISOString()

  return {
    txid: charge.txid,
    status: charge.status,
    brCode: qr.qrcode || charge.pixCopiaECola || '',
    brCodeBase64: qr.imagemQrcode,
    expiresAt,
    locationId: charge.loc.id,
  }
}

export type EfiPixDetail = {
  status: string
  valor: { original: string }
  pix?: Array<{ valor: string; endToEndId?: string }>
}

export async function getPixCharge(txid: string): Promise<EfiPixDetail> {
  return withEfi((efi) => efi.pixDetailCharge({ txid })) as Promise<EfiPixDetail>
}

export function isPixChargePaid(status: string) {
  return status.toUpperCase() === 'CONCLUIDA'
}

export type EfiNotification = {
  code: number
  data: Array<{
    created_at: string
    custom_id: string | null
    id: number
    identifiers: {
      charge_id?: number
      subscription_id?: number
    }
    status: {
      current: string
      previous: string | null
    }
    type: string
    value?: number
  }>
}

export async function getChargeNotification(
  token: string
): Promise<EfiNotification> {
  return withEfi((efi) =>
    efi.getNotification({ token })
  ) as Promise<EfiNotification>
}

export function isEfiChargePaid(status: string) {
  const normalized = status.toLowerCase()
  return (
    normalized === 'paid' ||
    normalized === 'settled' ||
    normalized === 'approved'
  )
}

export function getPublicEfiConfig() {
  return {
    payeeCode: config.efi.payeeCode,
    environment: config.efi.sandbox ? ('sandbox' as const) : ('production' as const),
    pixReady: Boolean(
      config.efi.clientId &&
        config.efi.clientSecret &&
        config.efi.pixKey &&
        config.efi.certificate &&
        config.efi.certificateSource !== 'missing'
    ),
    certificateSource: config.efi.certificateSource,
    cardReady: Boolean(config.efi.payeeCode),
  }
}

export function getEfiDiagnostics() {
  return {
    sandbox: config.efi.sandbox,
    hasClientId: Boolean(config.efi.clientId),
    hasClientSecret: Boolean(config.efi.clientSecret),
    hasPixKey: Boolean(config.efi.pixKey),
    hasPayeeCode: Boolean(config.efi.payeeCode),
    certificateSource: config.efi.certificateSource,
    certificatePath: config.efi.certificatePath || null,
    certificateLoaded: Boolean(
      config.efi.certificate && config.efi.certificateSource !== 'missing'
    ),
    notificationUrl: config.efi.notificationUrl || null,
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(serverRoot, '..')

function resolveCorsOrigin() {
  if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  }

  return 'http://localhost:5173'
}

type ResolvedCertificate = {
  /** Caminho do arquivo OU conteúdo base64 (quando certificateBase64=true) */
  value: string
  certificateBase64: boolean
  source: 'env-base64' | 'file' | 'missing'
  resolvedPath?: string
}

/**
 * Resolve o certificado .p12.
 * Se for um arquivo, lê e converte para base64 (mais confiável em deploy).
 */
function resolveEfiCertificate(
  raw: string,
  asBase64: boolean
): ResolvedCertificate {
  if (!raw) {
    return { value: '', certificateBase64: false, source: 'missing' }
  }

  if (asBase64) {
    return {
      value: raw.replace(/\s+/g, ''),
      certificateBase64: true,
      source: 'env-base64',
    }
  }

  const candidates = [
    path.isAbsolute(raw) ? raw : null,
    path.resolve(projectRoot, raw),
    path.resolve(serverRoot, raw),
    path.resolve(process.cwd(), raw),
    path.resolve(projectRoot, 'certs', path.basename(raw)),
    path.resolve(serverRoot, 'certs', path.basename(raw)),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue
    try {
      const base64 = fs.readFileSync(candidate).toString('base64').replace(/\s+/g, '')
      return {
        value: base64,
        certificateBase64: true,
        source: 'file',
        resolvedPath: candidate,
      }
    } catch (error) {
      console.error(`[efi] Falha ao ler certificado em ${candidate}:`, error)
    }
  }

  return {
    value: '',
    certificateBase64: false,
    source: 'missing',
    resolvedPath: path.resolve(projectRoot, raw),
  }
}

const efiCertificateRaw =
  process.env.EFI_CERTIFICATE ??
  // Fallback: certificado versionado no repositório
  './certs/producao-927103-Avaliimobe.p12'
const efiCertificateRequestedBase64 =
  process.env.EFI_CERTIFICATE_BASE64 === 'true'
const efiCertificate = resolveEfiCertificate(
  efiCertificateRaw,
  efiCertificateRequestedBase64
)

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://avalia:avalia123@localhost:5433/avalia_imob',
  jwtSecret: process.env.JWT_SECRET ?? 'avalia-imob-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  corsOrigin: resolveCorsOrigin(),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
  serperApiKey: process.env.SERPER_API_KEY ?? '',
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY ?? '',
    baseUrl:
      process.env.NVIDIA_API_BASE_URL ??
      'https://integrate.api.nvidia.com/v1',
    model:
      process.env.NVIDIA_MODEL ??
      'meta/llama-3.3-70b-instruct',
  },
  isProduction: process.env.NODE_ENV === 'production',
  efi: {
    // API Pix — variáveis essenciais (SDK oficial)
    clientId: process.env.EFI_CLIENT_ID ?? '',
    clientSecret: process.env.EFI_CLIENT_SECRET ?? '',
    // true = homologação | false = produção (padrão: sandbox se omitido)
    // Certificado de produção exige EFI_SANDBOX=false
    sandbox: process.env.EFI_SANDBOX !== 'false',
    /** Conteúdo base64 do .p12 ou caminho (legado) */
    certificate: efiCertificate.value,
    certificateBase64: efiCertificate.certificateBase64,
    certificateSource: efiCertificate.source,
    certificatePath: efiCertificate.resolvedPath ?? '',
    pixKey: process.env.EFI_PIX_KEY ?? '',
    // Só para checkout transparente (cartão) — não é necessário para Pix
    payeeCode: process.env.EFI_PAYEE_CODE ?? '',
    planId: process.env.EFI_PLAN_ID
      ? Number(process.env.EFI_PLAN_ID)
      : undefined,
    notificationUrl:
      process.env.EFI_NOTIFICATION_URL ??
      (process.env.APP_URL
        ? `${process.env.APP_URL.replace(/\/$/, '')}/api/payments/webhooks/efi`
        : ''),
    validateMtls: process.env.EFI_VALIDATE_MTLS === 'true',
  },
  appUrl: process.env.APP_URL ?? resolveCorsOrigin(),
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
    fromName: process.env.SMTP_FROM_NAME ?? 'Avalia Imob',
  },
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  },
}

const weakSecrets = new Set([
  'avalia-imob-dev-secret-change-me',
  'avalia-imob-dev-secret-change-in-production',
  'change-me',
  'secret',
])

if (
  config.isProduction &&
  (!process.env.JWT_SECRET || weakSecrets.has(config.jwtSecret))
) {
  throw new Error(
    'JWT_SECRET ausente ou inseguro. Defina uma chave forte nas variáveis de ambiente.'
  )
}

if (config.isProduction && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ausente em produção.')
}

if (config.isProduction) {
  const missingPix: string[] = []
  if (!config.efi.clientId) missingPix.push('EFI_CLIENT_ID')
  if (!config.efi.clientSecret) missingPix.push('EFI_CLIENT_SECRET')
  if (!config.efi.certificate) missingPix.push('EFI_CERTIFICATE')
  if (!config.efi.pixKey) missingPix.push('EFI_PIX_KEY')
  if (missingPix.length > 0) {
    console.warn(
      `[efi] Pix indisponível — faltam: ${missingPix.join(', ')}. Configure no painel da Efí (API > Aplicações + Certificado + Chave Pix).`
    )
  } else if (config.efi.certificateSource === 'missing') {
    console.warn(
      `[efi] Certificado não encontrado. Defina EFI_CERTIFICATE=./certs/producao-927103-Avaliimobe.p12 ou o base64 com EFI_CERTIFICATE_BASE64=true`
    )
  } else {
    console.log(
      `[efi] Pix ok — sandbox=${config.efi.sandbox} source=${config.efi.certificateSource}${config.efi.certificatePath ? ` path=${config.efi.certificatePath}` : ''}`
    )
  }
  if (!config.efi.payeeCode) {
    console.warn(
      '[efi] EFI_PAYEE_CODE ausente — checkout transparente (cartão) indisponível. Pix não precisa desta variável.'
    )
  }
}

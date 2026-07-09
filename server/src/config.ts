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

/**
 * Resolve o caminho do certificado .p12.
 * Aceita caminho relativo à raiz do projeto ou ao server/, ou valor base64.
 */
function resolveEfiCertificate(raw: string, asBase64: boolean) {
  if (!raw) return ''
  if (asBase64) return raw
  if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw

  const candidates = [
    path.resolve(projectRoot, raw),
    path.resolve(serverRoot, raw),
    path.resolve(process.cwd(), raw),
    path.resolve(projectRoot, 'certs', path.basename(raw)),
    path.resolve(serverRoot, 'certs', path.basename(raw)),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  // Mantém o valor original para a mensagem de erro do SDK ficar clara
  return path.resolve(projectRoot, raw)
}

const efiCertificateRaw = process.env.EFI_CERTIFICATE ?? ''
const efiCertificateBase64 = process.env.EFI_CERTIFICATE_BASE64 === 'true'

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://avalia:avalia123@localhost:5433/avalia_imob',
  jwtSecret: process.env.JWT_SECRET ?? 'avalia-imob-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  corsOrigin: resolveCorsOrigin(),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
  serperApiKey: process.env.SERPER_API_KEY ?? '',
  isProduction: process.env.NODE_ENV === 'production',
  efi: {
    // API Pix — variáveis essenciais (SDK oficial)
    clientId: process.env.EFI_CLIENT_ID ?? '',
    clientSecret: process.env.EFI_CLIENT_SECRET ?? '',
    // true = homologação | false = produção (padrão: sandbox se omitido)
    // Certificado de produção exige EFI_SANDBOX=false
    sandbox: process.env.EFI_SANDBOX !== 'false',
    /** Caminho absoluto do .p12 ou conteúdo base64 */
    certificate: resolveEfiCertificate(efiCertificateRaw, efiCertificateBase64),
    certificateBase64: efiCertificateBase64,
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
  } else if (
    !config.efi.certificateBase64 &&
    config.efi.certificate &&
    !fs.existsSync(config.efi.certificate)
  ) {
    console.warn(
      `[efi] Certificado não encontrado em: ${config.efi.certificate}`
    )
  } else {
    console.log(
      `[efi] Pix ok — sandbox=${config.efi.sandbox} cert=${config.efi.certificateBase64 ? '(base64)' : config.efi.certificate}`
    )
  }
  if (!config.efi.payeeCode) {
    console.warn(
      '[efi] EFI_PAYEE_CODE ausente — checkout transparente (cartão) indisponível. Pix não precisa desta variável.'
    )
  }
}

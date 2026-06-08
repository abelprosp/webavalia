import 'dotenv/config'

function resolveCorsOrigin() {
  if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  }

  return 'http://localhost:5173'
}

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
  asaas: {
    apiKey: process.env.ASAAS_API_KEY ?? '',
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? '',
    environment:
      process.env.ASAAS_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production',
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

if (config.isProduction && !config.asaas.webhookToken) {
  throw new Error('ASAAS_WEBHOOK_TOKEN ausente. Obrigatório em produção.')
}

if (config.isProduction && !config.asaas.apiKey) {
  throw new Error('ASAAS_API_KEY ausente. Obrigatório em produção.')
}

if (config.isProduction && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ausente em produção.')
}

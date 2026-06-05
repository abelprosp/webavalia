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
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: resolveCorsOrigin(),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
  serperApiKey: process.env.SERPER_API_KEY ?? '',
  isProduction: process.env.NODE_ENV === 'production',
}

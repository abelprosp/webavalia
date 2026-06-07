import pg from 'pg'
import { config } from '../config.js'

const isLocalDb =
  config.databaseUrl.includes('localhost') ||
  config.databaseUrl.includes('127.0.0.1')

const sslRejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: isLocalDb
    ? undefined
    : {
        rejectUnauthorized: sslRejectUnauthorized,
      },
})

import pg from 'pg'
import { config } from '../config.js'

const isLocalDb =
  config.databaseUrl.includes('localhost') ||
  config.databaseUrl.includes('127.0.0.1')

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
})

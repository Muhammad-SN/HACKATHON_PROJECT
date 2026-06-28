import { Pool } from 'pg'
import { validateEnv } from '@/lib/env'

let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    validateEnv()

    _pool = new Pool({
      connectionString: process.env['DATABASE_URL']!,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })

    _pool.on('error', (err) => {
      process.stderr.write(`[DB Pool] Unexpected error: ${err.message}\n`)
    })
  }

  return _pool
}

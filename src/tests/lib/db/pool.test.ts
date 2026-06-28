import { describe, it, expect, afterAll } from 'vitest'
import { getPool } from '@/lib/db/pool'

describe('getPool (integration — requires DATABASE_URL)', () => {
  it('returns the same Pool instance on repeated calls', () => {
    expect(getPool()).toBe(getPool())
  })

  it('executes a simple query successfully', async () => {
    const result = await getPool().query('SELECT 1 AS value')
    expect(result.rows[0]?.value).toBe(1)
  })

  it('returns current UTC timestamp from database', async () => {
    const result = await getPool().query('SELECT NOW() AS now')
    expect(result.rows[0]?.now).toBeInstanceOf(Date)
  })

  afterAll(async () => { await getPool().end() })
})

import { describe, it, expect, afterAll } from 'vitest'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env['DATABASE_URL'], ssl: { rejectUnauthorized: false } })
afterAll(() => pool.end())

describe('migration integration', () => {
  it('schema_migrations table exists', async () => {
    const r = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    `)
    expect(r.rows.length).toBe(1)
  })

  it('both migrations are recorded', async () => {
    const r = await pool.query('SELECT version FROM schema_migrations ORDER BY version')
    const versions = r.rows.map((row: { version: string }) => row.version)
    expect(versions).toContain('0001_initial_schema')
    expect(versions).toContain('0002_add_pgvector')
  })

  it('users table has all required columns', async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `)
    const cols = r.rows.map((row: { column_name: string }) => row.column_name)
    expect(cols).toContain('password_hash')
    expect(cols).toContain('deleted_at')
    expect(cols).toContain('stripe_customer_id')
    expect(cols).toContain('role')
    expect(cols).toContain('tier')
  })

  it('exams table has domain column', async () => {
    const r = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'exams' AND table_schema = 'public' AND column_name = 'domain'
    `)
    expect(r.rows.length).toBe(1)
  })

  it('question_embeddings table exists (pgvector migration)', async () => {
    const r = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'question_embeddings'
    `)
    expect(r.rows.length).toBe(1)
  })
})

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

async function migrate(): Promise<void> {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    const { rows } = await client.query('SELECT version FROM schema_migrations')
    const applied = new Set(rows.map((r: { version: string }) => r.version))

    const migrationsDir = path.join(process.cwd(), 'migrations')
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

    for (const file of files) {
      const version = file.replace('.sql', '')
      if (applied.has(version)) { console.log(`⏭  ${version} — already applied`); continue }

      console.log(`⬆  Applying ${version}...`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
        await client.query('COMMIT')
        console.log(`✅ Applied ${version}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${version} failed: ${(err as Error).message}`)
      }
    }
    console.log('\n✅ All migrations applied successfully')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => { process.stderr.write(`❌ ${err.message}\n`); process.exit(1) })

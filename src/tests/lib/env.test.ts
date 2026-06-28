import { describe, it, expect, afterEach } from 'vitest'

const REQUIRED = [
  'DATABASE_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'ANTHROPIC_API_KEY', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
]

const savedEnv: Record<string, string | undefined> = {}

afterEach(() => {
  for (const key of REQUIRED) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('validateEnv', () => {
  it('does not throw when all required vars are present', async () => {
    for (const key of REQUIRED) {
      savedEnv[key] = process.env[key]
      process.env[key] = 'test-value'
    }
    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).not.toThrow()
  })

  it('throws and names DATABASE_URL when it is missing', async () => {
    for (const key of REQUIRED) {
      savedEnv[key] = process.env[key]
      process.env[key] = 'test-value'
    }
    savedEnv['DATABASE_URL'] = process.env['DATABASE_URL']
    delete process.env['DATABASE_URL']
    const { validateEnv } = await import('@/lib/env')
    expect(() => validateEnv()).toThrow('DATABASE_URL')
  })
})

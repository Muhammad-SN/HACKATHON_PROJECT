import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { getPool } from '@/lib/db/pool'

const Schema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 422 }
    )
  }

  const { name, email, password } = parsed.data
  const passwordHash = await hash(password, 12)

  try {
    await getPool().query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
      [name, email, passwordHash]
    )
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Email already in use.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  }
}

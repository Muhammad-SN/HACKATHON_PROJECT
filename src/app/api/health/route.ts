import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await getPool().query('SELECT NOW()')
    return NextResponse.json(
      { status: 'ok', db: 'ok', ts: new Date().toISOString() },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'unreachable', ts: new Date().toISOString() },
      { status: 503 }
    )
  }
}

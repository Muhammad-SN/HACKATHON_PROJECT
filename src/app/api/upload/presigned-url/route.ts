import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { generateUploadPresignedUrl, buildS3Key } from '@/lib/s3/presigned'

const Schema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['application/pdf', 'text/plain']),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 422 })
  }

  const { filename, contentType } = parsed.data
  const key = buildS3Key(user!.id, filename)

  try {
    const url = await generateUploadPresignedUrl(key, contentType)
    return NextResponse.json({ success: true, data: { url, key }, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `S3 error: ${message}` }, { status: 500 })
  }
}

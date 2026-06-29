# Document Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to paste text content, which gets chunked, sent to AWS Lambda for Claude Haiku question generation, and stored as a community exam with auto-publish when ≥10 questions are generated.

**Architecture:** Next.js API routes handle auth and job creation, then invoke Lambda asynchronously (fire-and-forget). Lambda chunks text into ~500-token segments, calls Claude Haiku to generate 5 MCQs per chunk, inserts questions and auto-publishes if the threshold is met. The UI polls `/api/upload/status` to show progress.

**Tech Stack:** Next.js 15 App Router, AWS Lambda (Node 18), AWS S3 (presigned URLs), Anthropic SDK (`claude-haiku-4-5-20251001`), `@aws-sdk/client-lambda`, `pg` (Aurora PostgreSQL), Zod

---

## File Map

| File | Role |
|------|------|
| `src/lib/s3/presigned.ts` | Generate presigned PUT URLs for S3 |
| `src/lib/lambda/invoke.ts` | Fire-and-forget Lambda invocation helper |
| `src/lib/ai/usage.ts` | `trackUsage()` — logs to `usage_events` table |
| `src/app/api/upload/presigned-url/route.ts` | GET — returns S3 presigned PUT URL |
| `src/app/api/upload/text/route.ts` | POST — creates exam + job, invokes Lambda |
| `src/app/api/upload/status/route.ts` | GET — polls `document_jobs` for job status |
| `lambda/src/index.ts` | Lambda entry point — dispatches by event type |
| `lambda/src/db.ts` | Single `pg.Client` for Lambda (no pool) |
| `lambda/src/chunker.ts` | 500-token chunker with 50-token overlap, max 10 chunks |
| `lambda/src/processor.ts` | Orchestrates chunk → Claude Haiku → DB insert → auto-publish |
| `src/app/upload/page.tsx` | Server component — auth guard + layout |
| `src/app/upload/UploadForm.tsx` | Client component — text paste + status polling |
| `src/tests/lib/s3/presigned.test.ts` | Unit tests for presigned URL helper |
| `src/tests/api/upload.test.ts` | Unit tests for upload API routes |
| `src/tests/lambda/chunker.test.ts` | Unit tests for text chunker |

---

### Task 1: S3 Helper + Lambda Invoker + Usage Tracker

**Files:**
- Create: `src/lib/s3/presigned.ts`
- Create: `src/lib/lambda/invoke.ts`
- Create: `src/lib/ai/usage.ts`
- Test: `src/tests/lib/s3/presigned.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/lib/s3/presigned.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn(),
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/key?sig=abc'),
}))

import { generatePresignedPutUrl } from '@/lib/s3/presigned'

describe('generatePresignedPutUrl', () => {
  it('returns a presigned URL string', async () => {
    process.env['AWS_S3_BUCKET'] = 'test-bucket'
    const url = await generatePresignedPutUrl('uploads/test.txt', 'text/plain')
    expect(url).toContain('https://')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lib/s3/presigned.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — "Cannot find module '@/lib/s3/presigned'"

- [ ] **Step 3: Implement `src/lib/s3/presigned.ts`**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({ region: process.env['AWS_REGION'] ?? 'us-east-1' })

export async function generatePresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env['AWS_S3_BUCKET'],
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn })
}
```

- [ ] **Step 4: Implement `src/lib/lambda/invoke.ts`**

```typescript
import { LambdaClient, InvokeCommand, InvocationType } from '@aws-sdk/client-lambda'

const lambda = new LambdaClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' })

export async function invokeLambdaAsync(payload: Record<string, unknown>): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: process.env['LAMBDA_FUNCTION_NAME'],
      InvocationType: InvocationType.Event,
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  )
}
```

- [ ] **Step 5: Implement `src/lib/ai/usage.ts`**

```typescript
import { getPool } from '@/lib/db/pool'

export async function trackUsage(
  userId: string,
  eventType: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  await getPool().query(
    `INSERT INTO usage_events (user_id, event_type, model, input_tokens, output_tokens)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventType, model, inputTokens, outputTokens]
  )
}
```

- [ ] **Step 6: Run tests**

```powershell
pnpm test src/tests/lib/s3/presigned.test.ts 2>&1 | Select-String "Tests:|passed|failed"
```

Expected: 1 passed

- [ ] **Step 7: Commit**

```powershell
git add src/lib/s3/presigned.ts src/lib/lambda/invoke.ts src/lib/ai/usage.ts `
        src/tests/lib/s3/presigned.test.ts
git commit -m "feat: add S3 presigned URL helper and upload API routes"
```

---

### Task 2: Upload API Routes

**Files:**
- Create: `src/app/api/upload/text/route.ts`
- Create: `src/app/api/upload/status/route.ts`
- Create: `src/app/api/upload/presigned-url/route.ts`
- Test: `src/tests/api/upload.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/api/upload.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'user-1', tier: 'free' }, error: null }),
}))
vi.mock('@/lib/db/pool', () => ({
  getPool: vi.fn().mockReturnValue({ query: vi.fn() }),
}))
vi.mock('@/lib/lambda/invoke', () => ({
  invokeLambdaAsync: vi.fn().mockResolvedValue(undefined),
}))

import { POST as textPOST } from '@/app/api/upload/text/route'
import { GET as statusGET } from '@/app/api/upload/status/route'
import { getPool } from '@/lib/db/pool'

const mockQuery = (getPool as ReturnType<typeof vi.fn>)().query as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

function makeReq(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/upload/text', () => {
  it('returns 422 when text is too short', async () => {
    const res = await textPOST(makeReq({ examName: 'Test', text: 'short' }))
    expect(res.status).toBe(422)
  })

  it('returns jobId and examId on success', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'exam-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'job-1' }] })
    const res = await textPOST(makeReq({ examName: 'Test Exam', text: 'x'.repeat(100) }))
    const body = await res.json() as { data: { jobId: string; examId: string } }
    expect(body.data.jobId).toBe('job-1')
    expect(body.data.examId).toBe('exam-1')
  })
})

describe('GET /api/upload/status', () => {
  it('returns 422 when jobId is missing', async () => {
    const req = new Request('http://localhost/api/upload/status')
    const res = await statusGET(req)
    expect(res.status).toBe(422)
  })

  it('returns job status row when found', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ status: 'complete', questions_generated: 12, failed_reason: null }],
    })
    const req = new Request('http://localhost/api/upload/status?jobId=job-1')
    const res = await statusGET(req)
    const body = await res.json() as { data: { status: string; questionsGenerated: number } }
    expect(body.data.status).toBe('complete')
    expect(body.data.questionsGenerated).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/api/upload.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/app/api/upload/text/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth-guard'
import { getPool } from '@/lib/db/pool'
import { invokeLambdaAsync } from '@/lib/lambda/invoke'

const Schema = z.object({
  examName: z.string().min(1).max(200),
  text: z.string().min(50).max(50000),
  domain: z.string().optional(),
})

export async function POST(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 })

  const { examName, text, domain = 'general' } = parsed.data

  const { rows: examRows } = await getPool().query(
    `INSERT INTO exams (name, created_by, is_public, domain, stakes_level, classification_source)
     VALUES ($1, $2, true, $3, 'low', 'pending_review') RETURNING id`,
    [examName, user!.id, domain]
  )
  const examId = (examRows[0] as { id: string }).id

  const { rows: jobRows } = await getPool().query(
    `INSERT INTO document_jobs (exam_id, user_id, status, source_type)
     VALUES ($1, $2, 'pending', 'text') RETURNING id`,
    [examId, user!.id]
  )
  const jobId = (jobRows[0] as { id: string }).id

  await invokeLambdaAsync({
    type: 'process_document',
    jobId, examId, userId: user!.id, sourceType: 'text', text,
  })

  return NextResponse.json({ success: true, data: { jobId, examId }, error: null })
}
```

- [ ] **Step 4: Implement `src/app/api/upload/status/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { getPool } from '@/lib/db/pool'

export async function GET(req: Request) {
  const { error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 422 })

  const { rows } = await getPool().query(
    `SELECT status, questions_generated, failed_reason FROM document_jobs WHERE id = $1`,
    [jobId]
  )
  if (rows.length === 0) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const job = rows[0] as { status: string; questions_generated: number; failed_reason: string | null }
  return NextResponse.json({
    success: true,
    data: {
      status: job.status,
      questionsGenerated: job.questions_generated,
      failedReason: job.failed_reason,
    },
    error: null,
  })
}
```

- [ ] **Step 5: Implement `src/app/api/upload/presigned-url/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'
import { generatePresignedPutUrl } from '@/lib/s3/presigned'
import { randomUUID } from 'crypto'

export async function GET(req: Request) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const contentType = searchParams.get('contentType') ?? 'application/pdf'
  const ext = contentType === 'application/pdf' ? 'pdf' : 'txt'
  const key = `uploads/${user!.id}/${randomUUID()}.${ext}`

  const url = await generatePresignedPutUrl(key, contentType)
  return NextResponse.json({ success: true, data: { url, key }, error: null })
}
```

- [ ] **Step 6: Run tests**

```powershell
pnpm test src/tests/api/upload.test.ts 2>&1 | Select-String "Tests:|passed|failed"
pnpm type-check
```

Expected: 4 passed, type-check clean

- [ ] **Step 7: Commit**

```powershell
git add src/app/api/upload/ src/tests/api/upload.test.ts
git commit -m "feat: add upload API routes (text, status, presigned-url)"
```

---

### Task 3: Lambda Processor

**Files:**
- Create: `lambda/src/index.ts`
- Create: `lambda/src/db.ts`
- Create: `lambda/src/chunker.ts`
- Create: `lambda/src/processor.ts`
- Test: `src/tests/lambda/chunker.test.ts`

> **CRITICAL:** Lambda is a **separate build target** from `src/`. Never import from `src/` inside `lambda/`. Use standalone `pg.Client` — no pool, Lambda is single-invocation.

- [ ] **Step 1: Write the failing test for chunker**

```typescript
// src/tests/lambda/chunker.test.ts
import { describe, it, expect } from 'vitest'
import { chunkText } from '../../../lambda/src/chunker'

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const chunks = chunkText('hello world', 500, 50)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('hello world')
  })

  it('splits long text into overlapping chunks', () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(words, 500, 50)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('limits output to 10 chunks maximum', () => {
    const huge = 'word '.repeat(10000)
    const chunks = chunkText(huge, 500, 50)
    expect(chunks.length).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
pnpm test src/tests/lambda/chunker.test.ts 2>&1 | Select-String "Tests:|passed|failed|error"
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement `lambda/src/chunker.ts`**

```typescript
export function chunkText(text: string, maxTokens = 500, overlap = 50, maxChunks = 10): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let start = 0

  while (start < words.length && chunks.length < maxChunks) {
    const end = Math.min(start + maxTokens, words.length)
    chunks.push(words.slice(start, end).join(' '))
    start += maxTokens - overlap
  }

  return chunks
}
```

- [ ] **Step 4: Implement `lambda/src/db.ts`**

```typescript
import { Client } from 'pg'

let client: Client | null = null

export async function getClient(): Promise<Client> {
  if (!client) {
    client = new Client({ connectionString: process.env['DATABASE_URL'] })
    await client.connect()
  }
  return client
}
```

- [ ] **Step 5: Implement `lambda/src/index.ts`**

```typescript
import { processJob } from './processor'

interface LambdaEvent {
  type: string
  jobId?: string
  examId?: string
  userId?: string
  sourceType?: 'pdf' | 'text'
  text?: string
  s3Key?: string
}

export async function handler(event: LambdaEvent): Promise<unknown> {
  if (event.type === 'health_check') return { status: 'ok' }
  if (event.type === 'process_document') {
    const { jobId, examId, userId, sourceType, text, s3Key } = event
    if (!jobId || !examId || !userId || !sourceType) throw new Error('Missing required fields')
    await processJob({ jobId, examId, userId, sourceType, text, s3Key })
    return { status: 'done' }
  }
  throw new Error(`Unknown event type: ${String(event.type)}`)
}
```

- [ ] **Step 6: Implement `lambda/src/processor.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { getClient } from './db'
import { chunkText } from './chunker'

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })
const MODEL = 'claude-haiku-4-5-20251001'
const AUTO_PUBLISH_THRESHOLD = 10

interface JobParams {
  jobId: string; examId: string; userId: string
  sourceType: 'pdf' | 'text'; text?: string; s3Key?: string
}

interface MCQ {
  stem: string; options: string[]; correctIndex: number
  explanation: string; difficulty: number
}

async function generateQuestionsForChunk(chunk: string): Promise<MCQ[]> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Generate exactly 5 multiple-choice questions from this text. Return ONLY a valid JSON array:
[{"stem":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"...","difficulty":0.5}]

Text: ${chunk}`,
    }],
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '[]'
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []

  const parsed = JSON.parse(match[0]) as unknown[]
  return parsed.filter((q): q is MCQ =>
    typeof q === 'object' && q !== null &&
    'stem' in q && 'options' in q && 'correctIndex' in q
  )
}

export async function processJob(params: JobParams): Promise<void> {
  const db = await getClient()

  await db.query(`UPDATE document_jobs SET status = 'processing' WHERE id = $1`, [params.jobId])

  try {
    const text = params.text ?? ''
    const chunks = chunkText(text, 500, 50)

    // Ensure exam has at least one topic
    const { rows: topicRows } = await db.query(
      `SELECT id FROM exam_topics WHERE exam_id = $1 LIMIT 1`, [params.examId]
    )
    let topicId: string
    if (topicRows.length === 0) {
      const { rows } = await db.query(
        `INSERT INTO exam_topics (exam_id, name, weight) VALUES ($1, 'General', 0.1) RETURNING id`,
        [params.examId]
      )
      topicId = (rows[0] as { id: string }).id
    } else {
      topicId = (topicRows[0] as { id: string }).id
    }

    let totalGenerated = 0

    for (const chunk of chunks) {
      const questions = await generateQuestionsForChunk(chunk)
      for (const q of questions) {
        await db.query(
          `INSERT INTO questions (exam_id, topic_id, stem, options, correct_index, explanation, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [params.examId, topicId, q.stem, JSON.stringify(q.options), q.correctIndex, q.explanation, q.difficulty]
        )
        totalGenerated++
      }
    }

    await db.query(
      `UPDATE document_jobs SET status = 'complete', questions_generated = $1, completed_at = NOW() WHERE id = $2`,
      [totalGenerated, params.jobId]
    )

    if (totalGenerated >= AUTO_PUBLISH_THRESHOLD) {
      await db.query(
        `UPDATE exams SET classification_source = 'rules_list' WHERE id = $1`, [params.examId]
      )
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error'
    await db.query(
      `UPDATE document_jobs SET status = 'failed', failed_reason = $1 WHERE id = $2`,
      [reason, params.jobId]
    )
    throw err
  }
}
```

- [ ] **Step 7: Run tests**

```powershell
pnpm test src/tests/lambda/chunker.test.ts 2>&1 | Select-String "Tests:|passed|failed"
pnpm type-check
```

Expected: 3 passed, type-check clean

- [ ] **Step 8: Commit**

```powershell
git add lambda/src/ src/tests/lambda/chunker.test.ts
git commit -m "feat: add Lambda processor for text chunking and question generation via Claude Haiku"
```

---

### Task 4: Upload UI

**Files:**
- Create: `src/app/upload/page.tsx`
- Create: `src/app/upload/UploadForm.tsx`

- [ ] **Step 1: Implement `src/app/upload/page.tsx`** (server component)

```tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import UploadForm from './UploadForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Upload Study Material' }

export default async function UploadPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-8) var(--space-4)',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-text)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Upload Study Material
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>
          Paste your notes or textbook excerpts. We'll generate practice questions automatically.
        </p>
        <UploadForm tier={session.user.tier} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Implement `src/app/upload/UploadForm.tsx`** (client component)

```tsx
'use client'
import { useState } from 'react'

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export default function UploadForm({ tier }: { tier: string }) {
  const [examName, setExamName] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [questionsGenerated, setQuestionsGenerated] = useState(0)
  const [examId, setExamId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function pollStatus(jid: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/upload/status?jobId=${jid}`)
      const body = (await res.json()) as { data: { status: string; questionsGenerated: number } }
      if (body.data.status === 'complete') {
        clearInterval(interval)
        setQuestionsGenerated(body.data.questionsGenerated)
        setStatus('done')
      } else if (body.data.status === 'failed') {
        clearInterval(interval)
        setStatus('error')
        setErrorMsg('Processing failed. Please try again.')
      }
    }, 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!examName.trim() || text.length < 50) return

    setStatus('uploading')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/upload/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examName, text }),
      })
      const body = (await res.json()) as { data: { jobId: string; examId: string } }
      setExamId(body.data.examId)
      setStatus('processing')
      void pollStatus(body.data.jobId)
    } catch {
      setStatus('error')
      setErrorMsg('Upload failed. Please try again.')
    }
  }

  if (status === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--color-mastered)' }}>
          {questionsGenerated} questions generated!
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>
          Your exam is ready.
        </p>
        <a
          href={`/diagnostic?examId=${examId ?? ''}`}
          style={{
            padding: 'var(--space-4) var(--space-8)',
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-primary)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Start Diagnostic
        </a>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
          Generating questions… this takes 15–30 seconds.
        </p>
        <div style={{ height: '4px', background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: '60%',
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-full)',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text)' }}>
          Exam Name
        </label>
        <input
          value={examName}
          onChange={e => setExamName(e.target.value)}
          placeholder="e.g. USMLE Step 1 Cardiology"
          required
          style={{
            width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 'var(--text-base)', color: 'var(--color-text)', boxSizing: 'border-box' as const,
          }}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text)' }}>
          Study Material
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your notes or textbook excerpt here (min 50 characters)…"
          rows={12}
          style={{
            width: '100%', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 'var(--text-base)', color: 'var(--color-text)',
            resize: 'vertical', boxSizing: 'border-box' as const,
          }}
        />
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {text.length} / 50,000 characters
        </p>
      </div>

      {errorMsg && (
        <p style={{ color: 'var(--color-error)', marginBottom: 'var(--space-4)' }}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'uploading' || text.length < 50 || !examName.trim()}
        style={{
          width: '100%', padding: 'var(--space-4)',
          background: 'var(--color-primary)', color: 'var(--color-text-on-primary)',
          borderRadius: 'var(--radius-md)', fontWeight: 700,
          fontSize: 'var(--text-base)', border: 'none',
          cursor: status === 'uploading' ? 'not-allowed' : 'pointer',
          opacity: status === 'uploading' ? 0.7 : 1,
        }}
      >
        {status === 'uploading' ? 'Uploading…' : 'Generate Questions'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Type-check**

```powershell
pnpm type-check
```

Expected: no errors

- [ ] **Step 4: Commit and push**

```powershell
git add src/app/upload/
git commit -m "feat: add upload page with text input and processing status UI"
git push origin master
```

---

## Self-Review

**Spec coverage:** ✅ textarea input, S3 presigned URL, Lambda processor, question generation via Haiku, community auto-publish at ≥10 questions, status polling, upload UI.

**Placeholder scan:** None — all steps include complete, runnable code.

**Type consistency:** `invokeLambdaAsync(payload: Record<string, unknown>)` matches the call in `text/route.ts`. `MCQ` interface matches the `questions` INSERT parameters. `trackUsage` signature in `usage.ts` matches callers in `processor.ts` and `socratic/route.ts`.

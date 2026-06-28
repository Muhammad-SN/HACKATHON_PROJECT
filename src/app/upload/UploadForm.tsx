'use client'
import { useState } from 'react'
import type { AccountTier } from '@/types'

type UploadStep = 'form' | 'uploading' | 'processing' | 'done' | 'error'

export default function UploadForm({
  defaultExamName,
  aiMode: _aiMode,
  tier: _tier,
}: {
  defaultExamName: string
  aiMode: boolean
  tier: AccountTier
}) {
  const [step, setStep] = useState<UploadStep>('form')
  const [examName, setExamName] = useState(defaultExamName)
  const [text, setText] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [questionsGenerated, setQuestionsGenerated] = useState(0)
  const [examId, setExamId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!examName.trim() || !text.trim()) return
    setStep('uploading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/upload/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examName: examName.trim(), text: text.trim() }),
      })
      const body = (await res.json()) as {
        success: boolean
        data: { jobId: string; examId: string }
        error: string | null
      }
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Upload failed')
      setExamId(body.data.examId)
      setStep('processing')
      void pollStatus(body.data.jobId, body.data.examId)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setStep('error')
    }
  }

  async function pollStatus(jId: string, _eId: string) {
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise<void>((r) => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/upload/status?jobId=${jId}`)
        const body = (await res.json()) as {
          data: { status: string; questionsGenerated: number }
        }
        const { status, questionsGenerated: count } = body.data
        setQuestionsGenerated(count)
        if (status === 'complete') {
          setStep('done')
          return
        }
        if (status === 'failed') {
          setErrorMsg('Question generation failed. Please try again.')
          setStep('error')
          return
        }
      } catch {
        // continue polling
      }
    }
    setErrorMsg('Processing timed out. Please check back later.')
    setStep('error')
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {questionsGenerated} questions generated!
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>
          Your exam is ready. Start your diagnostic to build your personalized study plan.
        </p>
        <a
          href={examId ? `/diagnostic?examId=${examId}` : '/dashboard'}
          style={{
            display: 'inline-block',
            padding: 'var(--space-4) var(--space-8)',
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-primary)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
            textDecoration: 'none',
          }}
        >
          Start Diagnostic →
        </a>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <p
          style={{
            color: 'var(--color-primary)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            marginBottom: 'var(--space-4)',
          }}
        >
          Generating questions…
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>
          {questionsGenerated > 0
            ? `${questionsGenerated} questions so far`
            : 'Processing your materials…'}
        </p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <p style={{ color: 'var(--color-error)', marginBottom: 'var(--space-6)' }}>{errorMsg}</p>
        <button
          onClick={() => {
            setStep('form')
            setErrorMsg(null)
          }}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            background: 'var(--color-primary)',
            color: 'var(--color-text-on-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label
          htmlFor="exam-name"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text)',
          }}
        >
          Exam or subject name
        </label>
        <input
          id="exam-name"
          type="text"
          value={examName}
          onChange={(e) => setExamName(e.target.value)}
          placeholder="e.g. Organic Chemistry, USMLE Step 1, AWS SAA-C03"
          required
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-base)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <label
          htmlFor="content"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text)',
          }}
        >
          Study materials
        </label>
        <textarea
          id="content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your notes, textbook excerpts, lecture slides, or any study material here…"
          required
          rows={12}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-base)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-body)',
          }}
        />
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            marginTop: 'var(--space-1)',
          }}
        >
          {text.length} / 50,000 characters
        </p>
      </div>

      <button
        type="submit"
        disabled={step === 'uploading' || !examName.trim() || !text.trim()}
        style={{
          width: '100%',
          padding: 'var(--space-4)',
          background: 'var(--color-primary)',
          color: 'var(--color-text-on-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: 700,
          fontSize: 'var(--text-lg)',
          cursor: step === 'uploading' ? 'not-allowed' : 'pointer',
          opacity: step === 'uploading' ? 0.7 : 1,
        }}
      >
        {step === 'uploading' ? 'Uploading…' : 'Generate questions'}
      </button>
    </form>
  )
}

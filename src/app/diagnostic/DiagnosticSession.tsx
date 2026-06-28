'use client'
import { useState, useEffect, useCallback } from 'react'

interface Question {
  id: string
  stem: string
  options: string[]
  correctIndex: number
  topicId: string
}

type Phase = 'loading' | 'answering' | 'answered' | 'done' | 'error'

const LABELS = ['A', 'B', 'C', 'D']

export default function DiagnosticSession({ examId }: { examId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [step, setStep] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const startSession = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/diagnostic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      })
      const body = (await res.json()) as {
        data: { sessionId: string; question: Question | null; done: boolean }
      }
      if (body.data.done || !body.data.question) {
        setPhase('done')
        return
      }
      setSessionId(body.data.sessionId)
      setQuestion(body.data.question)
      setStep(1)
      setPhase('answering')
    } catch {
      setErrorMsg('Failed to start diagnostic. Please try again.')
      setPhase('error')
    }
  }, [examId])

  useEffect(() => {
    void startSession()
  }, [startSession])

  function handleAnswer(index: number) {
    if (phase !== 'answering' || !question) return
    setChosen(index)
    setIsCorrect(index === question.correctIndex)
    setPhase('answered')
  }

  async function handleNext() {
    if (!sessionId || !question || chosen === null) return
    setPhase('loading')
    try {
      const res = await fetch('/api/diagnostic/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: question.id,
          chosenIndex: chosen,
          timeSpentMs: 0,
        }),
      })
      const body = (await res.json()) as {
        data: { isCorrect: boolean; done: boolean; question: Question | null }
      }
      if (body.data.done || !body.data.question) {
        setPhase('done')
        return
      }
      setQuestion(body.data.question)
      setChosen(null)
      setIsCorrect(null)
      setStep((s) => s + 1)
      setPhase('answering')
    } catch {
      setErrorMsg('Something went wrong. Please refresh.')
      setPhase('error')
    }
  }

  if (phase === 'loading') {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--space-16)',
          color: 'var(--color-text-muted)',
        }}
      >
        Loading…
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--space-12)',
          color: 'var(--color-error)',
        }}
      >
        {errorMsg}
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-3xl)',
            color: 'var(--color-primary)',
            marginBottom: 'var(--space-4)',
            lineHeight: 1.2,
          }}
        >
          Your learning map is ready.
        </h2>
        <p
          style={{
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-8)',
            fontSize: 'var(--text-lg)',
          }}
        >
          We&apos;ve identified your strengths and weak spots. Time to study smarter.
        </p>
        <a
          href="/dashboard"
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
          Go to Dashboard →
        </a>
      </div>
    )
  }

  if (!question) return null

  return (
    <div>
      {/* Progress indicator */}
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          textAlign: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        Step {step} of 20
      </p>

      {/* Question card */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-lg)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xl)',
            color: 'var(--color-text)',
            lineHeight: 'var(--leading-normal)',
            margin: 0,
          }}
        >
          {question.stem}
        </p>
      </div>

      {/* Answer choices */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-8)',
        }}
      >
        {question.options.map((opt, i) => {
          let bg = 'var(--color-surface)'
          let border = '1px solid var(--color-border)'
          let color = 'var(--color-text)'

          if (phase === 'answered' && chosen !== null) {
            if (i === question.correctIndex) {
              bg = 'var(--color-mastered)'
              border = '2px solid var(--color-mastered)'
              color = 'var(--color-text-on-primary)'
            } else if (i === chosen) {
              bg = 'var(--color-weak)'
              border = '2px solid var(--color-weak)'
              color = 'var(--color-text-on-primary)'
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={phase === 'answered'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: 'var(--space-4)',
                background: bg,
                border,
                borderRadius: 'var(--radius-md)',
                cursor: phase === 'answered' ? 'default' : 'pointer',
                textAlign: 'left' as const,
                color,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: 'var(--radius-full)',
                  background: phase === 'answered' ? 'transparent' : 'var(--color-bg)',
                  fontWeight: 700,
                  fontSize: 'var(--text-sm)',
                  flexShrink: 0,
                  color: 'inherit',
                }}
              >
                {LABELS[i]}
              </span>
              <span style={{ fontSize: 'var(--text-base)' }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Next button — only visible after answering */}
      {phase === 'answered' && (
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              marginBottom: 'var(--space-4)',
              fontWeight: 600,
              fontSize: 'var(--text-base)',
              color: isCorrect ? 'var(--color-mastered)' : 'var(--color-weak)',
            }}
          >
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </p>
          <button
            onClick={() => { void handleNext() }}
            style={{
              padding: 'var(--space-3) var(--space-8)',
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: 'var(--text-base)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'

interface Question {
  id: string
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
  topicId: string
}

type Phase = 'loading' | 'answering' | 'answered' | 'done' | 'error'

const LABELS = ['A', 'B', 'C', 'D']

export default function StudySession({
  sessionId,
  examId,
}: {
  sessionId: string
  examId: string
}) {
  const [question, setQuestion] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [chosen, setChosen] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [socratic, setSocratic] = useState<string | null>(null)
  const [loadingSocratic, setLoadingSocratic] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number>(Date.now())

  const loadFirstQuestion = useCallback(async () => {
    if (!examId) {
      setPhase('error')
      setErrorMsg('Missing exam ID.')
      return
    }
    try {
      const res = await fetch('/api/study/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      })
      const body = (await res.json()) as { data: { question: Question | null; done: boolean } }
      if (body.data.done || !body.data.question) {
        setPhase('done')
        return
      }
      setQuestion(body.data.question)
      setStartTime(Date.now())
      setPhase('answering')
    } catch {
      setErrorMsg('Failed to start session.')
      setPhase('error')
    }
  }, [examId])

  useEffect(() => {
    void loadFirstQuestion()
  }, [loadFirstQuestion])

  async function fetchSocratic(q: Question, ci: number, correct: boolean) {
    setLoadingSocratic(true)
    try {
      const res = await fetch('/api/study/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionStem: q.stem,
          chosenOption: q.options[ci] ?? '',
          correctOption: q.options[q.correctIndex] ?? '',
          isCorrect: correct,
        }),
      })
      const body = (await res.json()) as { data: { explanation: string } }
      setSocratic(body.data.explanation)
    } catch {
      // Socratic is optional — silent fail
    } finally {
      setLoadingSocratic(false)
    }
  }

  function handleAnswer(index: number) {
    if (phase !== 'answering' || !question) return
    const correct = index === question.correctIndex
    setChosen(index)
    setIsCorrect(correct)
    setExplanation(question.explanation)
    setPhase('answered')
    void fetchSocratic(question, index, correct)
  }

  async function handleNext() {
    if (!question || chosen === null) return
    setPhase('loading')
    setSocratic(null)
    const elapsed = Date.now() - startTime
    try {
      const res = await fetch('/api/study/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: question.id,
          chosenIndex: chosen,
          timeSpentMs: elapsed,
        }),
      })
      const body = (await res.json()) as {
        data: { isCorrect: boolean; done: boolean; question: Question | null }
      }
      if (body.data.done || !body.data.question) {
        setAnsweredCount((c) => c + 1)
        setPhase('done')
        return
      }
      setQuestion(body.data.question)
      setChosen(null)
      setIsCorrect(null)
      setExplanation(null)
      setAnsweredCount((c) => c + 1)
      setStartTime(Date.now())
      setPhase('answering')
    } catch {
      setErrorMsg('Something went wrong. Please refresh.')
      setPhase('error')
    }
  }

  if (phase === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-text-muted)' }}>
        Loading…
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-error)' }}>
        {errorMsg ?? 'An error occurred.'}
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
          }}
        >
          Session complete.
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>
          {answeredCount} questions answered. Great work!
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
          <a
            href="/dashboard"
            style={{
              padding: 'var(--space-4) var(--space-8)',
              background: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Dashboard
          </a>
          <a
            href={`/study/new?examId=${examId}`}
            style={{
              padding: 'var(--space-4) var(--space-8)',
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              border: '1px solid var(--color-border)',
              textDecoration: 'none',
            }}
          >
            Study more
          </a>
        </div>
      </div>
    )
  }

  if (!question) return null

  return (
    <div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {question.options.map((opt, i) => {
          let bg = 'var(--color-surface)'
          let border = '1px solid var(--color-border)'
          let color = 'var(--color-text)'
          if (phase === 'answered') {
            if (i === question.correctIndex) {
              bg = 'var(--color-mastered)'; border = '2px solid var(--color-mastered)'; color = 'var(--color-text-on-primary)'
            } else if (i === chosen) {
              bg = 'var(--color-weak)'; border = '2px solid var(--color-weak)'; color = 'var(--color-text-on-primary)'
            }
          }
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={phase === 'answered'}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                padding: 'var(--space-4)', background: bg, border, borderRadius: 'var(--radius-md)',
                cursor: phase === 'answered' ? 'default' : 'pointer', textAlign: 'left' as const, color,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)',
                  background: phase === 'answered' ? 'transparent' : 'var(--color-bg)',
                  fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0, color: 'inherit',
                }}
              >
                {LABELS[i]}
              </span>
              <span style={{ fontSize: 'var(--text-base)' }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Feedback area */}
      {phase === 'answered' && (
        <div>
          {/* Correctness banner */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: isCorrect ? 'var(--color-mastered)' : 'var(--color-weak)',
              color: 'var(--color-text-on-primary)',
              marginBottom: 'var(--space-4)',
              fontWeight: 600,
            }}
          >
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </div>

          {/* Explanation */}
          {explanation && (
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
                borderLeft: '3px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {explanation}
            </div>
          )}

          {/* Socratic panel */}
          <div
            style={{
              background: 'var(--color-surface-raised)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-6)',
              marginBottom: 'var(--space-6)',
              borderTop: '2px solid var(--color-accent)',
              minHeight: '3rem',
              transition: 'all var(--duration-slow) var(--ease-out-expo)',
            }}
          >
            <p
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                color: 'var(--color-accent)',
                marginBottom: 'var(--space-2)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
              }}
            >
              Socratic Tutor
            </p>
            {loadingSocratic ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Thinking…</p>
            ) : socratic ? (
              <p style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', margin: 0 }}>
                {socratic}
              </p>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>—</p>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
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
        </div>
      )}
    </div>
  )
}

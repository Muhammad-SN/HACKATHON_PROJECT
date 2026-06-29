'use client';

import { useState, useEffect, useCallback } from 'react';

interface Question {
  id: string;
  text: string;
  choices: Array<{ id: string; text: string }>;
  topic: string;
  difficulty: number;
}

interface Props {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (choiceId: string) => Promise<{ correct: boolean; explanation: string }>;
  onNext: () => void;
}

type ChoiceState = 'default' | 'selected' | 'correct' | 'incorrect';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export default function DiagnosticQuestion({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onNext,
}: Props) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [choiceStates, setChoiceStates] = useState<Record<string, ChoiceState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [visibleChoices, setVisibleChoices] = useState<boolean[]>([]);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);
  const [skipHovered, setSkipHovered] = useState(false);

  const progress = (questionNumber / totalQuestions) * 100;

  useEffect(() => {
    setSelectedChoiceId(null);
    setChoiceStates({});
    setIsSubmitting(false);
    setSubmitted(false);
    setResult(null);
    setExplanationVisible(false);
    setVisibleChoices(new Array(question.choices.length).fill(false));

    const timers: ReturnType<typeof setTimeout>[] = [];
    question.choices.forEach((_, i) => {
      const t = setTimeout(() => {
        setVisibleChoices((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 50);
      timers.push(t);
    });

    return () => timers.forEach(clearTimeout);
  }, [question.id]);

  const handleChoiceSelect = useCallback(
    (choiceId: string) => {
      if (submitted) return;
      setSelectedChoiceId(choiceId);
      const updated: Record<string, ChoiceState> = {};
      question.choices.forEach((c) => {
        updated[c.id] = c.id === choiceId ? 'selected' : 'default';
      });
      setChoiceStates(updated);
    },
    [submitted, question.choices]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedChoiceId || isSubmitting || submitted) return;
    setIsSubmitting(true);
    try {
      const res = await onAnswer(selectedChoiceId);
      setResult(res);
      setSubmitted(true);
      const updated: Record<string, ChoiceState> = {};
      question.choices.forEach((c) => {
        if (res.correct && c.id === selectedChoiceId) {
          updated[c.id] = 'correct';
        } else if (!res.correct && c.id === selectedChoiceId) {
          updated[c.id] = 'incorrect';
        } else {
          updated[c.id] = 'default';
        }
      });
      setChoiceStates(updated);
      setTimeout(() => setExplanationVisible(true), 80);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedChoiceId, isSubmitting, submitted, onAnswer, question.choices]);

  const getChoiceStyle = (
    choiceId: string,
    index: number,
    isVisible: boolean
  ): React.CSSProperties => {
    const state: ChoiceState = choiceStates[choiceId] ?? 'default';
    const isSelected = state === 'selected';
    const isCorrect = state === 'correct';
    const isIncorrect = state === 'incorrect';

    let bg = 'var(--color-surface-raised)';
    let border = 'var(--color-border)';
    let shadow = 'none';
    let labelBg = 'var(--color-bg)';
    let labelColor = 'var(--color-text-muted)';
    let cursor = submitted ? 'default' : 'pointer';

    if (isSelected) {
      bg = 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-raised))';
      border = 'var(--color-primary)';
      shadow = 'var(--shadow-sm)';
      labelBg = 'var(--color-primary)';
      labelColor = 'var(--color-text-on-primary)';
    }
    if (isCorrect) {
      bg = 'color-mix(in srgb, var(--color-success) 10%, var(--color-surface-raised))';
      border = 'var(--color-success)';
      shadow = 'var(--shadow-sm)';
      labelBg = 'var(--color-success)';
      labelColor = '#fff';
    }
    if (isIncorrect) {
      bg = 'color-mix(in srgb, var(--color-error) 10%, var(--color-surface-raised))';
      border = 'var(--color-error)';
      shadow = 'var(--shadow-sm)';
      labelBg = 'var(--color-error)';
      labelColor = '#fff';
    }

    return {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-4)',
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 'var(--radius-lg)',
      cursor,
      boxShadow: shadow,
      transition: `all var(--duration-normal) var(--ease-out-expo)`,
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
      userSelect: 'none' as const,
      WebkitUserSelect: 'none' as const,
      outline: 'none',
    };
  };

  const getLabelStyle = (choiceId: string): React.CSSProperties => {
    const state: ChoiceState = choiceStates[choiceId] ?? 'default';
    const isSelected = state === 'selected';
    const isCorrect = state === 'correct';
    const isIncorrect = state === 'incorrect';

    let bg = 'var(--color-bg)';
    let color = 'var(--color-text-muted)';
    let border = '1.5px solid var(--color-border)';

    if (isSelected) {
      bg = 'var(--color-primary)';
      color = 'var(--color-text-on-primary)';
      border = '1.5px solid var(--color-primary)';
    }
    if (isCorrect) {
      bg = 'var(--color-success)';
      color = '#fff';
      border = '1.5px solid var(--color-success)';
    }
    if (isIncorrect) {
      bg = 'var(--color-error)';
      color = '#fff';
      border = '1.5px solid var(--color-error)';
    }

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2rem',
      height: '2rem',
      minWidth: '2rem',
      borderRadius: 'var(--radius-sm)',
      background: bg,
      color,
      border,
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      transition: `all var(--duration-fast) var(--ease-out-expo)`,
    };
  };

  const getDotColor = (dotIndex: number): string => {
    const filled = dotIndex < question.difficulty;
    if (!filled) return 'var(--color-border)';
    if (question.difficulty <= 2) return 'var(--color-success)';
    if (question.difficulty === 3) return 'var(--color-accent)';
    return 'var(--color-error)';
  };

  const submitDisabled = !selectedChoiceId || isSubmitting || submitted;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        maxWidth: '680px',
        width: '100%',
        margin: '0 auto',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ── PROGRESS BAR ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            Question {questionNumber} of {totalQuestions}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px var(--space-3)',
              background: 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))',
              color: 'var(--color-accent)',
              borderRadius: 'var(--radius-xl)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            }}
          >
            {question.topic}
          </span>
        </div>

        {/* Track */}
        <div
          role="progressbar"
          aria-valuenow={questionNumber}
          aria-valuemin={1}
          aria-valuemax={totalQuestions}
          aria-label={`Question ${questionNumber} of ${totalQuestions}`}
          style={{
            width: '100%',
            height: '5px',
            background: 'var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--color-primary)',
              borderRadius: 'var(--radius-xl)',
              transition: `width var(--duration-slow) var(--ease-out-expo)`,
            }}
          />
        </div>
      </div>

      {/* ── DIFFICULTY DOTS ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
        aria-label={`Difficulty: ${question.difficulty} out of 5`}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
            marginRight: 'var(--space-1)',
          }}
        >
          Difficulty
        </span>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: getDotColor(i),
              display: 'inline-block',
              transition: `background var(--duration-fast) var(--ease-out-expo)`,
            }}
          />
        ))}
      </div>

      {/* ── QUESTION CARD ── */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
          padding: 'var(--space-8)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            color: 'var(--color-text)',
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 500,
          }}
        >
          {question.text}
        </p>
      </div>

      {/* ── ANSWER CHOICES ── */}
      <div
        role="radiogroup"
        aria-label="Answer choices"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {question.choices.map((choice, i) => (
          <button
            key={choice.id}
            role="radio"
            aria-checked={selectedChoiceId === choice.id}
            aria-disabled={submitted}
            onClick={() => handleChoiceSelect(choice.id)}
            style={getChoiceStyle(choice.id, i, visibleChoices[i] ?? false)}
          >
            <span style={getLabelStyle(choice.id)}>{CHOICE_LABELS[i] ?? String.fromCharCode(65 + i)}</span>
            <span
              style={{
                fontSize: 'var(--text-base, 1rem)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.5,
                textAlign: 'left',
              }}
            >
              {choice.text}
            </span>
          </button>
        ))}
      </div>

      {/* ── EXPLANATION PANEL ── */}
      {submitted && result && (
        <div
          role="region"
          aria-label="Answer explanation"
          style={{
            overflow: 'hidden',
            maxHeight: explanationVisible ? '500px' : '0',
            opacity: explanationVisible ? 1 : 0,
            transform: explanationVisible ? 'translateY(0)' : 'translateY(-8px)',
            transition: `max-height var(--duration-slow) var(--ease-out-expo), opacity var(--duration-normal) var(--ease-out-expo), transform var(--duration-normal) var(--ease-out-expo)`,
          }}
        >
          <div
            style={{
              background: result.correct
                ? 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))'
                : 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))',
              borderLeft: `4px solid ${result.correct ? 'var(--color-success)' : 'var(--color-error)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              border: `1px solid ${result.correct ? 'color-mix(in srgb, var(--color-success) 25%, transparent)' : 'color-mix(in srgb, var(--color-error) 25%, transparent)'}`,
              borderLeftWidth: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: result.correct ? 'var(--color-success)' : 'var(--color-error)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {result.correct ? '✓' : '✕'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  color: result.correct ? 'var(--color-success)' : 'var(--color-error)',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                {result.correct ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.6,
              }}
            >
              {result.explanation}
            </p>
          </div>
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          paddingTop: 'var(--space-2)',
        }}
      >
        {/* Submit / Next */}
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={submitDisabled}
            onMouseEnter={() => setSubmitHovered(true)}
            onMouseLeave={() => setSubmitHovered(false)}
            aria-label="Submit your answer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-8)',
              background: submitDisabled
                ? 'var(--color-border)'
                : submitHovered
                ? 'var(--color-primary-hover)'
                : 'var(--color-primary)',
              color: submitDisabled ? 'var(--color-text-muted)' : 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              letterSpacing: '0.03em',
              cursor: submitDisabled ? 'not-allowed' : 'pointer',
              transition: `all var(--duration-fast) var(--ease-out-expo)`,
              boxShadow: submitDisabled
                ? 'none'
                : submitHovered
                ? 'var(--shadow-md)'
                : 'var(--shadow-sm)',
              transform: !submitDisabled && submitHovered ? 'translateY(-1px)' : 'translateY(0)',
              outline: 'none',
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'cogniprep-spin 0.7s linear infinite',
                  }}
                />
                Checking…
              </>
            ) : (
              'Submit Answer'
            )}
          </button>
        ) : (
          <button
            onClick={onNext}
            onMouseEnter={() => setNextHovered(true)}
            onMouseLeave={() => setNextHovered(false)}
            aria-label="Go to next question"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-8)',
              background: nextHovered ? 'var(--color-primary-hover)' : 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              letterSpacing: '0.03em',
              cursor: 'pointer',
              transition: `all var(--duration-fast) var(--ease-out-expo)`,
              boxShadow: nextHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              transform: nextHovered ? 'translateY(-1px)' : 'translateY(0)',
              outline: 'none',
            }}
          >
            Next Question
            <span aria-hidden="true" style={{ fontSize: '1em', lineHeight: 1 }}>
              →
            </span>
          </button>
        )}

        {/* Skip link */}
        {!submitted && (
          <button
            onClick={onNext}
            onMouseEnter={() => setSkipHovered(true)}
            onMouseLeave={() => setSkipHovered(false)}
            aria-label="Skip this question"
            style={{
              background: 'none',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: skipHovered ? 'var(--color-text)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              textDecoration: skipHovered ? 'underline' : 'none',
              transition: `color var(--duration-fast) var(--ease-out-expo)`,
              outline: 'none',
              marginLeft: 'auto',
            }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Spinner keyframes injected once */}
      <style>{`
        @keyframes cogniprep-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

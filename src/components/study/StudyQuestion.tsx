'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Choice {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  choices: Array<Choice>;
  topic: string;
}

interface AnswerResult {
  correct: boolean;
  explanation: string;
  socraticSteps: string[];
}

interface Props {
  question: Question;
  streak: number;
  masteryLevel: number;
  onAnswer: (choiceId: string) => Promise<AnswerResult>;
  onNext: () => void;
}

type Phase = 'answering' | 'correct' | 'incorrect';

export default function StudyQuestion({
  question,
  streak,
  masteryLevel,
  onAnswer,
  onNext,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [streakPulse, setStreakPulse] = useState(false);
  const [choiceHovered, setChoiceHovered] = useState<string | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when question changes
  useEffect(() => {
    setSelectedId(null);
    setPhase('answering');
    setResult(null);
    setPanelOpen(false);
    setRevealedHints(0);
    setStreakPulse(false);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
  }, [question.id]);

  const handleSubmit = useCallback(async () => {
    if (!selectedId || loading || phase !== 'answering') return;
    setLoading(true);
    try {
      const res = await onAnswer(selectedId);
      setResult(res);
      if (res.correct) {
        setPhase('correct');
        setStreakPulse(true);
        setTimeout(() => setStreakPulse(false), 700);
        autoAdvanceRef.current = setTimeout(() => {
          onNext();
        }, 1500);
      } else {
        setPhase('incorrect');
        setTimeout(() => setPanelOpen(true), 150);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId, loading, phase, onAnswer, onNext]);

  const handleNextHint = () => {
    if (result && revealedHints < result.socraticSteps.length) {
      setRevealedHints((n) => n + 1);
    }
  };

  const handleGotIt = () => {
    setPanelOpen(false);
    setTimeout(() => onNext(), 350);
  };

  const clampedMastery = Math.min(100, Math.max(0, masteryLevel));

  const getChoiceState = (id: string): 'default' | 'hovered' | 'selected' | 'correct' | 'incorrect' => {
    if (phase === 'answering') {
      if (id === selectedId) return 'selected';
      if (id === choiceHovered) return 'hovered';
      return 'default';
    }
    if (phase === 'correct') {
      if (id === selectedId) return 'correct';
      return 'default';
    }
    if (phase === 'incorrect') {
      if (id === selectedId) return 'incorrect';
      return 'default';
    }
    return 'default';
  };

  const choiceStyles = (state: ReturnType<typeof getChoiceState>): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-md)',
      border: '2px solid',
      cursor: phase === 'answering' ? 'pointer' : 'default',
      transition: `background var(--duration-fast), border-color var(--duration-fast), box-shadow var(--duration-fast), transform var(--duration-fast)`,
      outline: 'none',
      textAlign: 'left',
      width: '100%',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
    };
    switch (state) {
      case 'hovered':
        return {
          ...base,
          background: 'var(--color-surface-raised)',
          borderColor: 'var(--color-primary)',
          boxShadow: 'var(--shadow-sm)',
          transform: 'translateY(-1px)',
        };
      case 'selected':
        return {
          ...base,
          background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
          borderColor: 'var(--color-primary)',
          boxShadow: 'var(--shadow-md)',
        };
      case 'correct':
        return {
          ...base,
          background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
          borderColor: 'var(--color-success)',
          boxShadow: 'var(--shadow-sm)',
        };
      case 'incorrect':
        return {
          ...base,
          background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
          borderColor: 'var(--color-error)',
          boxShadow: 'var(--shadow-sm)',
        };
      default:
        return {
          ...base,
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'none',
        };
    }
  };

  const choiceBadgeStyles = (state: ReturnType<typeof getChoiceState>): React.CSSProperties => ({
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    fontFamily: 'var(--font-body)',
    background:
      state === 'selected'
        ? 'var(--color-primary)'
        : state === 'correct'
        ? 'var(--color-success)'
        : state === 'incorrect'
        ? 'var(--color-error)'
        : 'var(--color-surface-raised)',
    color:
      state === 'selected' || state === 'correct' || state === 'incorrect'
        ? 'var(--color-text-on-primary)'
        : 'var(--color-text-muted)',
    transition: `background var(--duration-fast), color var(--duration-fast)`,
  });

  const letters = ['A', 'B', 'C', 'D'];

  const submitDisabled = !selectedId || loading || phase !== 'answering';

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        background: 'var(--color-bg)',
        minHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── TOP BAR ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Streak */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-lg)',
              display: 'inline-block',
              transform: streakPulse ? 'scale(1.5)' : 'scale(1)',
              transition: `transform var(--duration-fast) var(--ease-out-expo)`,
            }}
            aria-hidden="true"
          >
            🔥
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--color-accent)',
              transform: streakPulse ? 'scale(1.25)' : 'scale(1)',
              display: 'inline-block',
              transition: `transform var(--duration-fast) var(--ease-out-expo), color var(--duration-fast)`,
            }}
            aria-label={`Streak: ${streak}`}
          >
            {streak}
          </span>
        </div>

        {/* Topic name */}
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-text)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 200,
          }}
        >
          {question.topic}
        </span>

        {/* Mastery progress */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 'var(--space-1)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Mastery {clampedMastery}%
          </span>
          <div
            style={{
              width: 100,
              height: 6,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-border)',
              overflow: 'hidden',
            }}
            role="progressbar"
            aria-valuenow={clampedMastery}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Mastery level"
          >
            <div
              style={{
                height: '100%',
                width: `${clampedMastery}%`,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary)',
                transition: `width var(--duration-slow) var(--ease-out-expo)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── QUESTION CARD ── */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        {/* Topic chip */}
        <div>
          <span
            style={{
              display: 'inline-block',
              background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {question.topic}
          </span>
        </div>

        {/* Question text */}
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: 'var(--color-text)',
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          {question.text}
        </p>

        {/* Choices */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
          role="radiogroup"
          aria-label="Answer choices"
        >
          {question.choices.map((choice, idx) => {
            const state = getChoiceState(choice.id);
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selectedId === choice.id}
                disabled={phase !== 'answering'}
                onClick={() => phase === 'answering' && setSelectedId(choice.id)}
                onMouseEnter={() => phase === 'answering' && setChoiceHovered(choice.id)}
                onMouseLeave={() => setChoiceHovered(null)}
                style={choiceStyles(state)}
              >
                <span style={choiceBadgeStyles(state)}>
                  {letters[idx] ?? idx + 1}
                </span>
                <span
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.5,
                    paddingTop: 2,
                  }}
                >
                  {choice.text}
                </span>
                {state === 'correct' && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      flexShrink: 0,
                      color: 'var(--color-success)',
                      fontSize: 'var(--text-base)',
                    }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
                {state === 'incorrect' && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      flexShrink: 0,
                      color: 'var(--color-error)',
                      fontSize: 'var(--text-base)',
                    }}
                    aria-hidden="true"
                  >
                    ✗
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CORRECT FEEDBACK ── */}
      {phase === 'correct' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-5)',
            background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
            animation: 'fadeSlideUp var(--duration-normal) var(--ease-out-expo) both',
          }}
          role="status"
          aria-live="polite"
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              color: 'var(--color-accent)',
            }}
          >
            Excellent! +1 streak
          </span>
          <span
            style={{
              fontSize: 'var(--text-base)',
              display: 'inline-block',
              animation: 'streakBounce var(--duration-normal) var(--ease-out-expo) both',
            }}
            aria-hidden="true"
          >
            🔥
          </span>
        </div>
      )}

      {/* ── SUBMIT BUTTON ── */}
      {phase === 'answering' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={submitDisabled}
            onClick={handleSubmit}
            style={{
              padding: 'var(--space-3) var(--space-8)',
              borderRadius: 'var(--radius-md)',
              background: submitDisabled
                ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)'
                : 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              border: 'none',
              cursor: submitDisabled ? 'not-allowed' : 'pointer',
              boxShadow: submitDisabled ? 'none' : 'var(--shadow-md)',
              transition: `background var(--duration-fast), box-shadow var(--duration-fast), transform var(--duration-fast), opacity var(--duration-fast)`,
              transform: 'translateY(0)',
              opacity: submitDisabled ? 0.55 : 1,
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              if (!submitDisabled) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-lg)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = submitDisabled ? 'none' : 'var(--shadow-md)';
            }}
            aria-label="Check your answer"
          >
            {loading ? 'Checking…' : 'Check Answer'}
          </button>
        </div>
      )}

      {/* ── SOCRATIC PANEL ── */}
      <>
        {/* Backdrop */}
        <div
          aria-hidden="true"
          onClick={() => {}}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'color-mix(in srgb, var(--color-bg) 60%, transparent)',
            opacity: panelOpen ? 1 : 0,
            pointerEvents: panelOpen ? 'auto' : 'none',
            transition: `opacity var(--duration-slow) var(--ease-out-expo)`,
            zIndex: 40,
          }}
        />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Socratic hints panel"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-6)',
            zIndex: 50,
            transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: `transform var(--duration-slow) var(--ease-out-expo)`,
            maxHeight: '70vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* Handle bar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'calc(var(--space-2) * -1)' }}>
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-border)',
              }}
            />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              Let me help you understand
            </h2>
            {result?.explanation && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {result.explanation}
              </p>
            )}
          </div>

          {/* Numbered hint steps */}
          {result && result.socraticSteps.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
              aria-live="polite"
              aria-label="Hint steps"
            >
              {result.socraticSteps.map((step, i) => {
                const revealed = i < revealedHints;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 'var(--space-3)',
                      alignItems: 'flex-start',
                      opacity: revealed ? 1 : 0,
                      transform: revealed ? 'translateY(0)' : 'translateY(10px)',
                      transition: `opacity var(--duration-normal) var(--ease-out-expo), transform var(--duration-normal) var(--ease-out-expo)`,
                      pointerEvents: revealed ? 'auto' : 'none',
                    }}
                    aria-hidden={!revealed}
                  >
                    {/* Step number bubble */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-primary)',
                        color: 'var(--color-text-on-primary)',
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text)',
                        lineHeight: 1.55,
                      }}
                    >
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'flex-end',
              paddingTop: 'var(--space-2)',
            }}
          >
            {result && revealedHints < result.socraticSteps.length && (
              <button
                type="button"
                onClick={handleNextHint}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  border: '2px solid var(--color-primary)',
                  cursor: 'pointer',
                  transition: `background var(--duration-fast), box-shadow var(--duration-fast)`,
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'color-mix(in srgb, var(--color-primary) 10%, transparent)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-raised)';
                }}
                aria-label="Reveal next hint"
              >
                Next Hint
              </button>
            )}
            <button
              type="button"
              onClick={handleGotIt}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: `background var(--duration-fast), box-shadow var(--duration-fast), transform var(--duration-fast)`,
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)';
              }}
              aria-label="Got it, continue to next question"
            >
              Got it
            </button>
          </div>
        </div>
      </>

      {/* Keyframe animations injected via style tag */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes streakBounce {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.5) rotate(-8deg); }
          65%  { transform: scale(1.3) rotate(6deg); }
          85%  { transform: scale(1.1) rotate(-3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

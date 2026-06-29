'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Exam {
  id: string;
  name: string;
  subject: string;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  enrolledCount: number;
}

interface Props {
  tier: 'free' | 'premium';
}

const POPULAR_EXAMS: Exam[] = [
  { id: 'pop-1', name: 'SAT Math', subject: 'Mathematics', questionCount: 58, difficulty: 'medium', enrolledCount: 142300 },
  { id: 'pop-2', name: 'AWS Cloud Practitioner', subject: 'Cloud Computing', questionCount: 65, difficulty: 'easy', enrolledCount: 98700 },
  { id: 'pop-3', name: 'USMLE Step 1', subject: 'Medicine', questionCount: 280, difficulty: 'hard', enrolledCount: 54200 },
  { id: 'pop-4', name: 'CompTIA Security+', subject: 'Cybersecurity', questionCount: 90, difficulty: 'medium', enrolledCount: 76400 },
  { id: 'pop-5', name: 'GRE Verbal', subject: 'Language Arts', questionCount: 40, difficulty: 'medium', enrolledCount: 61800 },
  { id: 'pop-6', name: 'CFA Level 1', subject: 'Finance', questionCount: 180, difficulty: 'hard', enrolledCount: 39500 },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const difficultyConfig: Record<
  Exam['difficulty'],
  { label: string; bg: string; color: string }
> = {
  easy: { label: 'Easy', bg: '#d1fae5', color: '#065f46' },
  medium: { label: 'Medium', bg: '#fef3c7', color: '#92400e' },
  hard: { label: 'Hard', bg: '#fee2e2', color: '#991b1b' },
};

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-line {
          background: linear-gradient(
            90deg,
            var(--color-border) 25%,
            var(--color-surface-raised) 50%,
            var(--color-border) 75%
          );
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: var(--radius-sm);
        }
      `}</style>
      <div className="skeleton-line" style={{ height: 20, width: '70%' }} />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <div className="skeleton-line" style={{ height: 22, width: 80 }} />
        <div className="skeleton-line" style={{ height: 22, width: 60 }} />
      </div>
      <div className="skeleton-line" style={{ height: 14, width: '50%' }} />
    </div>
  );
}

function ExamCard({
  exam,
  selected,
  onClick,
}: {
  exam: Exam;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const diff = difficultyConfig[exam.difficulty];

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={selected}
      aria-label={`Select ${exam.name}`}
      style={{
        all: 'unset',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        background: 'var(--color-surface)',
        border: selected
          ? '2px solid var(--color-primary)'
          : '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-5)',
        cursor: 'pointer',
        textAlign: 'left',
        transform: hovered && !selected ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: `transform var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo), border-color var(--duration-fast) var(--ease-out-expo)`,
        position: 'relative',
        outline: 'none',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {selected && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            right: 'var(--space-3)',
            width: 24,
            height: 24,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none" aria-hidden="true">
            <path
              d="M1.5 5L5 8.5L11.5 1.5"
              stroke="var(--color-text-on-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-base, 1rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
          lineHeight: 1.3,
          paddingRight: selected ? 'var(--space-8)' : 0,
        }}
      >
        {exam.name}
      </span>

      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text-muted)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 10px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {exam.subject}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            background: diff.bg,
            color: diff.color,
            borderRadius: 'var(--radius-full)',
            padding: '2px 10px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {diff.label}
        </span>
      </span>

      <span
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {exam.questionCount} questions
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2.5 13c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {formatCount(exam.enrolledCount)} enrolled
        </span>
      </span>
    </button>
  );
}

function ConfirmationPanel({
  exam,
  onEnroll,
  enrolling,
  visible,
}: {
  exam: Exam;
  onEnroll: () => void;
  enrolling: boolean;
  visible: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (panelRef.current) {
      setHeight(visible ? panelRef.current.scrollHeight : 0);
    }
  }, [visible, exam]);

  return (
    <div
      style={{
        overflow: 'hidden',
        height: height,
        transition: `height var(--duration-normal) var(--ease-out-expo)`,
      }}
      aria-live="polite"
    >
      <div ref={panelRef}>
        <div
          style={{
            marginTop: 'var(--space-4)',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
                fontWeight: 500,
              }}
            >
              You selected
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--color-text)',
                lineHeight: 1.2,
              }}
            >
              {exam.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              {exam.subject} &middot; {exam.questionCount} questions &middot;{' '}
              {difficultyConfig[exam.difficulty].label} difficulty
            </span>
          </div>

          <EnrollButton enrolling={enrolling} onEnroll={onEnroll} />
        </div>
      </div>
    </div>
  );
}

function EnrollButton({
  enrolling,
  onEnroll,
}: {
  enrolling: boolean;
  onEnroll: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onEnroll}
      disabled={enrolling}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        all: 'unset',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        background: enrolling
          ? 'var(--color-primary-hover)'
          : hovered
          ? 'var(--color-primary-hover)'
          : 'var(--color-primary)',
        color: 'var(--color-text-on-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-base, 1rem)',
        fontWeight: 600,
        padding: 'var(--space-3) var(--space-6)',
        borderRadius: 'var(--radius-full)',
        cursor: enrolling ? 'not-allowed' : 'pointer',
        opacity: enrolling ? 0.8 : 1,
        transition: `background var(--duration-fast) var(--ease-out-expo), opacity var(--duration-fast) var(--ease-out-expo), transform var(--duration-fast) var(--ease-out-expo)`,
        transform: hovered && !enrolling ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered && !enrolling ? 'var(--shadow-md)' : 'none',
        alignSelf: 'flex-start',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    >
      {enrolling ? (
        <>
          <SpinnerIcon />
          Starting&hellip;
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Start My Diagnostic
        </>
      )}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .cp-spinner { animation: spin 0.7s linear infinite; }
      `}</style>
      <svg
        className="cp-spinner"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="28"
          strokeDashoffset="10"
          strokeLinecap="round"
        />
      </svg>
    </>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-12) var(--space-4)',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
      }}
      role="status"
      aria-live="polite"
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="14" stroke="var(--color-border)" strokeWidth="2.5" />
        <path
          d="M32 32l8 8"
          stroke="var(--color-border)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M18 22h8M22 18v8"
          stroke="var(--color-border)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-base, 1rem)',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        No exams found for &ldquo;{query}&rdquo;
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          maxWidth: 320,
          lineHeight: 1.6,
        }}
      >
        Try a different keyword, subject area, or certification name. We&apos;re constantly adding
        new exams!
      </span>
    </div>
  );
}

export default function OnboardingSearch({ tier }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [exams, setExams] = useState<Exam[]>(POPULAR_EXAMS);
  const [loading, setLoading] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const fetchExams = useCallback(async (q: string) => {
    if (!q.trim()) {
      setExams(POPULAR_EXAMS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setExams(data.exams ?? []);
    } catch {
      setError('Something went wrong. Please try again.');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams(debouncedQuery);
  }, [debouncedQuery, fetchExams]);

  const handleSelect = (exam: Exam) => {
    setSelectedExam((prev) => (prev?.id === exam.id ? null : exam));
  };

  const handleEnroll = async () => {
    if (!selectedExam) return;
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedExam.id }),
      });
      if (!res.ok) throw new Error('Enrollment failed');
      router.push('/diagnostic');
    } catch {
      setError('Could not enroll. Please try again.');
      setEnrolling(false);
    }
  };

  const sectionLabel = debouncedQuery.trim()
    ? `Results for "${debouncedQuery}"`
    : 'Popular exams';

  return (
    <section
      style={{
        width: '100%',
        maxWidth: 760,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        fontFamily: 'var(--font-body)',
      }}
      aria-label="Exam search"
    >
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <label htmlFor="exam-search" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          Search exams
        </label>
        <div
          style={{
            position: 'absolute',
            left: 'var(--space-5)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: inputFocused ? 'var(--color-primary)' : 'var(--color-text-muted)',
            transition: `color var(--duration-fast) var(--ease-out-expo)`,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-hidden="true"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M14 14l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <input
          ref={inputRef}
          id="exam-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedExam(null);
          }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Search exams, certifications, subjects..."
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%',
            height: 48,
            paddingLeft: 'calc(var(--space-5) + 28px)',
            paddingRight: query ? 'calc(var(--space-5) + 28px)' : 'var(--space-5)',
            border: inputFocused
              ? `2px solid var(--color-border-focus)`
              : `1.5px solid var(--color-border)`,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base, 1rem)',
            outline: 'none',
            boxShadow: inputFocused ? `0 0 0 3px color-mix(in srgb, var(--color-border-focus) 20%, transparent)` : 'var(--shadow-sm)',
            transition: `border-color var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo)`,
            boxSizing: 'border-box',
            appearance: 'none',
            WebkitAppearance: 'none',
          }}
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedExam(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            style={{
              all: 'unset',
              position: 'absolute',
              right: 'var(--space-4)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-surface-raised)',
              transition: `background var(--duration-fast) var(--ease-out-expo)`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Tier badge */}
      {tier === 'free' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
          }}
          role="note"
        >
          <span
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 10px',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-accent)',
            }}
          >
            Free plan
          </span>
          <span>You can take 1 diagnostic exam. Upgrade for unlimited access.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Results area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: 0,
          }}
        >
          {loading ? 'Searching…' : sectionLabel}
        </h2>

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-4)',
            }}
            aria-busy="true"
            aria-label="Loading exams"
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : exams.length === 0 ? (
          <EmptyState query={debouncedQuery} />
        ) : (
          <div
            role="list"
            aria-label="Exam results"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {exams.map((exam) => (
              <div key={exam.id} role="listitem">
                <ExamCard
                  exam={exam}
                  selected={selectedExam?.id === exam.id}
                  onClick={() => handleSelect(exam)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation panel */}
      {selectedExam && (
        <ConfirmationPanel
          exam={selectedExam}
          onEnroll={handleEnroll}
          enrolling={enrolling}
          visible={!!selectedExam}
        />
      )}
    </section>
  );
}

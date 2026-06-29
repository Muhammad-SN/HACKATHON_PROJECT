import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { CSSProperties } from "react";

interface Props {
  userName: string;
  readinessScore: number;
}

const topics = [
  { name: "Algebra", pct: 88, level: "mastered" },
  { name: "Calculus", pct: 34, level: "weak" },
  { name: "Statistics", pct: 61, level: "learning" },
  { name: "Trigonometry", pct: 45, level: "learning" },
  { name: "Geometry", pct: 79, level: "mastered" },
  { name: "Linear Algebra", pct: 23, level: "weak" },
  { name: "Probability", pct: 55, level: "learning" },
  { name: "Number Theory", pct: 88, level: "mastered" },
];

const sessions = [
  {
    date: "Jun 28, 2026",
    topic: "Calculus — Limits & Derivatives",
    questions: 40,
    accuracy: 72,
  },
  {
    date: "Jun 26, 2026",
    topic: "Algebra — Quadratic Equations",
    questions: 55,
    accuracy: 91,
  },
  {
    date: "Jun 24, 2026",
    topic: "Statistics — Hypothesis Testing",
    questions: 30,
    accuracy: 63,
  },
];

function levelColor(level: string): string {
  if (level === "mastered") return "var(--color-mastered)";
  if (level === "weak") return "var(--color-weak)";
  return "var(--color-learning)";
}

function levelLabel(level: string): string {
  if (level === "mastered") return "Mastered";
  if (level === "weak") return "Weak";
  return "Learning";
}

function accuracyColor(acc: number): string {
  if (acc >= 80) return "var(--color-mastered)";
  if (acc >= 60) return "var(--color-learning)";
  return "var(--color-weak)";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// SVG ring maths
const RING_R = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');
  return <DashboardContent userName={session.user.name ?? session.user.email ?? 'Student'} readinessScore={74} />;
}

function DashboardContent({
  userName = "Alexandra Chen",
  readinessScore = 74,
}: Props) {
  const clampedScore = Math.min(100, Math.max(0, readinessScore));
  const dashOffset =
    RING_CIRCUMFERENCE - (clampedScore / 100) * RING_CIRCUMFERENCE;

  // ─── Styles ────────────────────────────────────────────────────────────────

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    background: "var(--color-bg-dark)",
    fontFamily: "var(--font-body)",
    color: "var(--color-text-dark)",
  };

  // NAV
  const navStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 var(--space-8)",
    height: "64px",
    borderBottom: "1px solid var(--color-border-dark)",
    background: "var(--color-surface-dark)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  };

  const logoStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--color-accent)",
    letterSpacing: "-0.03em",
    userSelect: "none",
  };

  const logoDotStyle: CSSProperties = {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    marginLeft: "3px",
    verticalAlign: "middle",
    position: "relative",
    bottom: "2px",
  };

  const navRightStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  };

  const navUserNameStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    color: "var(--color-text-muted-dark)",
    letterSpacing: "0.01em",
  };

  const avatarStyle: CSSProperties = {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#0a0a0a",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.05em",
    flexShrink: 0,
    border: "1.5px solid var(--color-accent)",
  };

  // MAIN
  const mainStyle: CSSProperties = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "var(--space-10) var(--space-8) var(--space-16)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-8)",
  };

  const sectionHeadingStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
    color: "var(--color-text-muted-dark)",
    marginBottom: "var(--space-4)",
  };

  // READINESS ISLAND
  const heroCardStyle: CSSProperties = {
    background: "var(--color-surface-dark)",
    border: "1px solid var(--color-border-dark)",
    borderRadius: "var(--radius-xl)",
    padding: "var(--space-10) var(--space-8)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-6)",
    boxShadow: "var(--shadow-lg)",
    position: "relative",
    overflow: "hidden",
  };

  const heroGlowStyle: CSSProperties = {
    position: "absolute",
    top: "-80px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "400px",
    height: "300px",
    background:
      "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, transparent 70%)",
    pointerEvents: "none",
  };

  const ringWrapperStyle: CSSProperties = {
    position: "relative",
    width: "220px",
    height: "220px",
    flexShrink: 0,
  };

  const ringCenterStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
  };

  const scoreNumStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "3.5rem",
    fontWeight: 700,
    lineHeight: 1,
    color: "var(--color-accent)",
    letterSpacing: "-0.04em",
  };

  const scorePctStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.25rem",
    fontWeight: 400,
    color: "var(--color-text-muted-dark)",
  };

  const heroTitleStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "var(--color-text-dark)",
    textAlign: "center",
    letterSpacing: "-0.02em",
  };

  const heroSubtitleStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    color: "var(--color-text-muted-dark)",
    textAlign: "center",
    maxWidth: "440px",
    lineHeight: 1.6,
  };

  const heroStatsRowStyle: CSSProperties = {
    display: "flex",
    gap: "var(--space-8)",
    marginTop: "var(--space-2)",
  };

  const heroStatStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-1)",
  };

  const heroStatValueStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.375rem",
    fontWeight: 700,
    color: "var(--color-text-dark)",
    letterSpacing: "-0.02em",
  };

  const heroStatLabelStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.75rem",
    color: "var(--color-text-muted-dark)",
    letterSpacing: "0.05em",
  };

  const heroStatDividerStyle: CSSProperties = {
    width: "1px",
    height: "36px",
    background: "var(--color-border-dark)",
    alignSelf: "center",
  };

  // ACTION TILES
  const tileBaseStyle: CSSProperties = {
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-6)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };

  const tileAStyle: CSSProperties = {
    ...tileBaseStyle,
    background: "var(--color-primary)",
    border: "1px solid var(--color-primary)",
    boxShadow:
      "0 0 0 0 transparent, 0 4px 24px color-mix(in srgb, var(--color-primary) 30%, transparent)",
  };

  const tileBStyle: CSSProperties = {
    ...tileBaseStyle,
    background: "var(--color-surface-dark)",
    border: "1px solid var(--color-accent)",
    boxShadow:
      "0 0 0 0 transparent, 0 4px 24px color-mix(in srgb, var(--color-accent) 12%, transparent)",
  };

  const tileCStyle: CSSProperties = {
    ...tileBaseStyle,
    background: "var(--color-surface-dark)",
    border: "1px solid var(--color-border-dark)",
    boxShadow: "var(--shadow-sm)",
  };

  const tileEmojiStyle: CSSProperties = {
    fontSize: "1.75rem",
    lineHeight: 1,
  };

  const tileTitleStyle = (onPrimary: boolean): CSSProperties => ({
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    fontWeight: 600,
    color: onPrimary ? "#fff" : "var(--color-text-dark)",
    letterSpacing: "-0.01em",
  });

  const tileDescStyle = (onPrimary: boolean): CSSProperties => ({
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: onPrimary
      ? "rgba(255,255,255,0.75)"
      : "var(--color-text-muted-dark)",
    lineHeight: 1.55,
  });

  const tileArrowStyle = (onPrimary: boolean): CSSProperties => ({
    fontFamily: "var(--font-body)",
    fontSize: "0.75rem",
    color: onPrimary ? "rgba(255,255,255,0.6)" : "var(--color-accent)",
    marginTop: "auto",
    display: "flex",
    alignItems: "center",
    gap: "var(--space-1)",
  });

  // MASTERY HEATMAP
  const topicCardStyle: CSSProperties = {
    background: "var(--color-surface-dark)",
    border: "1px solid var(--color-border-dark)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-4) var(--space-5)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    boxShadow: "var(--shadow-sm)",
  };

  const topicNameStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--color-text-dark)",
    letterSpacing: "-0.005em",
  };

  const topicRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const topicPctStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--color-text-dark)",
    letterSpacing: "-0.03em",
  };

  const trackStyle: CSSProperties = {
    width: "100%",
    height: "4px",
    background: "var(--color-border-dark)",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
  };

  // RECENT SESSIONS
  const sessionListStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  };

  const sessionItemStyle: CSSProperties = {
    background: "var(--color-surface-dark)",
    border: "1px solid var(--color-border-dark)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-5) var(--space-6)",
    display: "grid",
    gridTemplateColumns: "1fr auto auto auto",
    alignItems: "center",
    gap: "var(--space-6)",
    boxShadow: "var(--shadow-sm)",
    transition: "border-color 0.15s ease",
  };

  const sessionTopicStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    fontWeight: 500,
    color: "var(--color-text-dark)",
    letterSpacing: "-0.005em",
  };

  const sessionDateStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.75rem",
    color: "var(--color-text-muted-dark)",
    marginTop: "var(--space-1)",
  };

  const sessionMetaStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "var(--space-1)",
  };

  const sessionMetaValueStyle: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--color-text-dark)",
    letterSpacing: "-0.02em",
  };

  const sessionMetaLabelStyle: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    color: "var(--color-text-muted-dark)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  };

  const sessionDividerStyle: CSSProperties = {
    width: "1px",
    height: "28px",
    background: "var(--color-border-dark)",
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {/* ── NAV ── */}
      <nav style={navStyle} role="navigation" aria-label="Main navigation">
        <span style={logoStyle}>
          CogniPrep
          <span style={logoDotStyle} aria-hidden="true" />
        </span>
        <div style={navRightStyle}>
          <span style={navUserNameStyle}>{userName}</span>
          <div
            style={avatarStyle}
            role="img"
            aria-label={`${userName} avatar`}
          >
            {getInitials(userName)}
          </div>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main style={mainStyle} className="dashboard-main">
        {/* ── READINESS ISLAND ── */}
        <section aria-labelledby="readiness-heading">
          <p style={sectionHeadingStyle} id="readiness-heading">
            Exam Readiness
          </p>
          <div style={heroCardStyle}>
            <div style={heroGlowStyle} aria-hidden="true" />

            {/* SVG Ring */}
            <div style={ringWrapperStyle}>
              <svg
                viewBox="0 0 200 200"
                width="220"
                height="220"
                aria-hidden="true"
                style={{ transform: "rotate(-90deg)" }}
              >
                {/* Track */}
                <circle
                  cx="100"
                  cy="100"
                  r={RING_R}
                  fill="none"
                  stroke="var(--color-border-dark)"
                  strokeWidth="14"
                />
                {/* Progress */}
                <circle
                  cx="100"
                  cy="100"
                  r={RING_R}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${RING_CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  style={{
                    transition: "stroke-dashoffset 1s ease",
                    filter:
                      "drop-shadow(0 0 6px color-mix(in srgb, var(--color-accent) 60%, transparent))",
                  }}
                />
                {/* Subtle tick marks */}
                {Array.from({ length: 20 }).map((_, i) => {
                  const angle = (i / 20) * 360;
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 100 + 92 * Math.cos(rad);
                  const y1 = 100 + 92 * Math.sin(rad);
                  const x2 = 100 + 97 * Math.cos(rad);
                  const y2 = 100 + 97 * Math.sin(rad);
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="var(--color-border-dark)"
                      strokeWidth="1"
                      opacity="0.5"
                    />
                  );
                })}
              </svg>
              <div style={ringCenterStyle}>
                <span style={scoreNumStyle}>{clampedScore}</span>
                <span style={scorePctStyle}>%</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <h1 style={heroTitleStyle}>Exam Readiness Score</h1>
              <p style={heroSubtitleStyle}>
                You&apos;re on track — keep up with daily sessions to push past
                80% before your target exam date.
              </p>
            </div>

            <div style={heroStatsRowStyle}>
              <div style={heroStatStyle}>
                <span style={heroStatValueStyle}>12</span>
                <span style={heroStatLabelStyle}>Sessions</span>
              </div>
              <div style={heroStatDividerStyle} />
              <div style={heroStatStyle}>
                <span style={heroStatValueStyle}>348</span>
                <span style={heroStatLabelStyle}>Questions</span>
              </div>
              <div style={heroStatDividerStyle} />
              <div style={heroStatStyle}>
                <span style={heroStatValueStyle}>79%</span>
                <span style={heroStatLabelStyle}>Avg. Accuracy</span>
              </div>
              <div style={heroStatDividerStyle} />
              <div style={heroStatStyle}>
                <span style={heroStatValueStyle}>14d</span>
                <span style={heroStatLabelStyle}>Streak</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── ACTION TILES ── */}
        <section aria-labelledby="actions-heading">
          <p style={sectionHeadingStyle} id="actions-heading">
            Quick Actions
          </p>
          <div className="tiles-grid">
            {/* Tile A */}
            <div style={tileAStyle} role="button" tabIndex={0}>
              <span style={tileEmojiStyle} aria-hidden="true">
                📖
              </span>
              <span style={tileTitleStyle(true)}>Continue Studying</span>
              <span style={tileDescStyle(true)}>
                Resume your adaptive session on Calculus — Limits &amp;
                Derivatives.
              </span>
              <span style={tileArrowStyle(true)}>
                Resume session&nbsp;→
              </span>
            </div>
            {/* Tile B */}
            <div style={tileBStyle} role="button" tabIndex={0}>
              <span style={tileEmojiStyle} aria-hidden="true">
                🧠
              </span>
              <span style={tileTitleStyle(false)}>Start Diagnostic</span>
              <span style={tileDescStyle(false)}>
                Take a targeted diagnostic to pinpoint your knowledge gaps
                instantly.
              </span>
              <span style={tileArrowStyle(false)}>
                Run diagnostic&nbsp;→
              </span>
            </div>
            {/* Tile C */}
            <div style={tileCStyle} role="button" tabIndex={0}>
              <span style={tileEmojiStyle} aria-hidden="true">
                📁
              </span>
              <span style={tileTitleStyle(false)}>Upload Materials</span>
              <span style={tileDescStyle(false)}>
                Import PDFs, notes or syllabus files to generate personalized
                question sets.
              </span>
              <span style={tileArrowStyle(false)}>
                Upload now&nbsp;→
              </span>
            </div>
          </div>
        </section>

        {/* ── MASTERY HEATMAP ── */}
        <section aria-labelledby="mastery-heading">
          <p style={sectionHeadingStyle} id="mastery-heading">
            Topic Mastery
          </p>
          <div className="mastery-grid">
            {topics.map((t) => {
              const color = levelColor(t.level);
              const badgeStyle: CSSProperties = {
                display: "inline-flex",
                alignItems: "center",
                padding: "2px var(--space-2)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
                fontFamily: "var(--font-body)",
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
                color: color,
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              };

              const fillStyle: CSSProperties = {
                height: "100%",
                width: `${t.pct}%`,
                background: color,
                borderRadius: "var(--radius-sm)",
                boxShadow: `0 0 6px color-mix(in srgb, ${color} 45%, transparent)`,
                transition: "width 0.6s ease",
              };

              return (
                <div key={t.name} style={topicCardStyle}>
                  <div style={topicRowStyle}>
                    <span style={topicNameStyle}>{t.name}</span>
                    <span style={badgeStyle}>{levelLabel(t.level)}</span>
                  </div>
                  <div style={topicRowStyle}>
                    <span style={topicPctStyle}>{t.pct}%</span>
                  </div>
                  <div style={trackStyle} role="progressbar" aria-valuenow={t.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} mastery`}>
                    <div style={fillStyle} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RECENT SESSIONS ── */}
        <section aria-labelledby="sessions-heading">
          <p style={sectionHeadingStyle} id="sessions-heading">
            Recent Sessions
          </p>
          <div style={sessionListStyle}>
            {sessions.map((s, i) => {
              const accColor = accuracyColor(s.accuracy);
              const accValueStyle: CSSProperties = {
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
                fontWeight: 700,
                color: accColor,
                letterSpacing: "-0.02em",
              };
              return (
                <div key={i} style={sessionItemStyle}>
                  <div>
                    <p style={sessionTopicStyle}>{s.topic}</p>
                    <p style={sessionDateStyle}>{s.date}</p>
                  </div>

                  <div style={sessionMetaStyle}>
                    <span style={sessionMetaValueStyle}>{s.questions}</span>
                    <span style={sessionMetaLabelStyle}>Questions</span>
                  </div>

                  <div style={sessionDividerStyle} />

                  <div style={sessionMetaStyle}>
                    <span style={accValueStyle}>{s.accuracy}%</span>
                    <span style={sessionMetaLabelStyle}>Accuracy</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

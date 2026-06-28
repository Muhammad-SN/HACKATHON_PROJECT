export interface Sm2Record {
  intervalDays: number
  easeFactor: number
  repetitionCount: number
}

export interface Sm2Update extends Sm2Record {
  nextReviewAt: Date
}

const MIN_EASE = 1.3

// quality: 0-5 (5=perfect, 3=correct with difficulty, 0-2=incorrect)
export function sm2Update(record: Sm2Record, quality: number, now: Date): Sm2Update {
  const q = Math.max(0, Math.min(5, quality))

  let { intervalDays, easeFactor, repetitionCount } = record

  if (q < 3) {
    repetitionCount = 0
    intervalDays = 1
  } else {
    if (repetitionCount === 0) {
      intervalDays = 1
    } else if (repetitionCount === 1) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(intervalDays * easeFactor)
    }
    repetitionCount++
  }

  easeFactor = Math.max(
    MIN_EASE,
    easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  )

  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)

  return { intervalDays, easeFactor, repetitionCount, nextReviewAt }
}

export function qualityFromCorrect(isCorrect: boolean, timeSpentMs: number, expectedMs = 15000): number {
  if (!isCorrect) return 1
  const ratio = timeSpentMs / expectedMs
  if (ratio < 0.5) return 5
  if (ratio < 1.0) return 4
  if (ratio < 2.0) return 3
  return 3
}

export function defaultSm2Record(): Sm2Record {
  return { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0 }
}

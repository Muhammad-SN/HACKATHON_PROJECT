export interface IrtQuestion {
  id: string
  difficulty: number       // b parameter
  discrimination: number   // a parameter
  topicId: string
}

export interface IrtAnswer {
  question: IrtQuestion
  correct: boolean
}

const D = 1.7
const MAX_ANSWERS = 20
const SE_THRESHOLD = 0.3
const THETA_CLAMP = 4

export function calculateProbability(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-D * a * (theta - b)))
}

export function calculateInformation(theta: number, a: number, b: number): number {
  const p = calculateProbability(theta, a, b)
  return D * D * a * a * p * (1 - p)
}

export function estimateAbility(answers: IrtAnswer[]): number {
  if (answers.length === 0) return 0
  let theta = 0
  for (let iter = 0; iter < 20; iter++) {
    let firstDeriv = 0
    let secondDeriv = 0
    for (const { question: { discrimination: a, difficulty: b }, correct } of answers) {
      const p = calculateProbability(theta, a, b)
      const u = correct ? 1 : 0
      firstDeriv += D * a * (u - p)
      secondDeriv += -(D * D) * a * a * p * (1 - p)
    }
    if (Math.abs(secondDeriv) < 1e-10) break
    const step = firstDeriv / secondDeriv
    theta = Math.max(-THETA_CLAMP, Math.min(THETA_CLAMP, theta - step))
    if (Math.abs(step) < 0.001) break
  }
  return theta
}

export function selectNextQuestion(
  theta: number,
  candidates: IrtQuestion[],
  answeredIds: Set<string>
): IrtQuestion | null {
  let best: IrtQuestion | null = null
  let bestInfo = -Infinity
  for (const q of candidates) {
    if (answeredIds.has(q.id)) continue
    const info = calculateInformation(theta, q.discrimination, q.difficulty)
    if (info > bestInfo) {
      bestInfo = info
      best = q
    }
  }
  return best
}

export function shouldStopDiagnostic(answerCount: number, answers: IrtAnswer[]): boolean {
  if (answerCount >= MAX_ANSWERS) return true
  if (answers.length === 0) return false
  const theta = estimateAbility(answers)
  const totalInfo = answers.reduce(
    (sum, { question: { discrimination: a, difficulty: b } }) =>
      sum + calculateInformation(theta, a, b),
    0
  )
  const se = totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : Infinity
  return se < SE_THRESHOLD
}

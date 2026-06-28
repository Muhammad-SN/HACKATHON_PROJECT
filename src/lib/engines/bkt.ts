const P_TRANSIT = 0.1   // probability of learning after each attempt
const P_SLIP    = 0.15  // probability of correct answer despite not knowing
const P_GUESS   = 0.25  // probability of correct answer by guessing

export function updateMastery(priorMastery: number, isCorrect: boolean): number {
  const pCorrectKnow = 1 - P_SLIP
  const pCorrectNotKnow = P_GUESS

  // P(know | answer) using Bayes
  const pCorrect = priorMastery * pCorrectKnow + (1 - priorMastery) * pCorrectNotKnow

  let posteriorKnow: number
  if (isCorrect) {
    posteriorKnow = (priorMastery * pCorrectKnow) / pCorrect
  } else {
    const pIncorrect = 1 - pCorrect
    posteriorKnow = (priorMastery * P_SLIP) / pIncorrect
  }

  // Apply transit: student may have learned
  const updated = posteriorKnow + (1 - posteriorKnow) * P_TRANSIT
  return Math.max(0, Math.min(1, updated))
}

export function isMastered(mastery: number, threshold = 0.85): boolean {
  return mastery >= threshold
}

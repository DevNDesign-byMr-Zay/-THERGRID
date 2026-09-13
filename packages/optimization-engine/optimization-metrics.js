export function compareOptimizationResults(reference, candidate) {
  if (!reference || !candidate || !Number.isFinite(reference.objective) || !Number.isFinite(candidate.objective)) {
    throw new TypeError('both optimization results must include numeric objectives.');
  }
  const gap = candidate.objective - reference.objective;
  const denominator = Math.max(1, Math.abs(reference.objective));
  return {
    referenceObjective: reference.objective,
    candidateObjective: candidate.objective,
    objectiveGap: gap,
    relativeGap: gap / denominator,
    candidateMatchesReference: gap === 0,
  };
}

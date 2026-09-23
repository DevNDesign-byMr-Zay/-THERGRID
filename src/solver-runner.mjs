import { compareSolverEvidence, evaluatePromotionGate } from './solver-evaluation.mjs';

const RUNNER_VERSION = 4;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function completeEvidence(value) {
  return Boolean(
    value &&
      value.experimentId &&
      value.inputSnapshotId &&
      value.candidate?.model &&
      value.candidate?.solver &&
      value.candidate?.version &&
      Number.isFinite(value.objective) &&
      typeof value.feasible === 'boolean' &&
      Number.isFinite(value.runtimeMs) &&
      Array.isArray(value.provenance) &&
      value.provenance.length >= 2,
  );
}

export async function runSolverCandidates({
  adapters,
  input,
  timeoutMs = 5000,
  validation = {},
} = {}) {
  if (!Array.isArray(adapters) || adapters.length === 0)
    throw new TypeError('adapters must contain at least one adapter');
  object(input, 'input');
  object(validation, 'validation');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0)
    throw new TypeError('timeoutMs must be a positive integer');

  const settled = await Promise.all(
    adapters.map(async (adapter, index) => {
      object(adapter, `adapters[${index}]`);
      const identity = object(adapter.identity, `adapters[${index}].identity`);
      const label = `${text(identity.model, `adapters[${index}].identity.model`)}:${text(identity.solver, `adapters[${index}].identity.solver`)}`;
      const started = Date.now();
      let timer;
      try {
        const result = await Promise.race([
          Promise.resolve().then(() => adapter.solve(input)),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`solver timeout after ${timeoutMs}ms`)),
              timeoutMs,
            );
          }),
        ]);
        clearTimeout(timer);
        object(result, `${label} evidence`);
        const evidence = Object.freeze({
          ...result,
          runtimeMs: Number.isFinite(result.runtimeMs) ? result.runtimeMs : Date.now() - started,
        });
        return { index, evidence, failure: null };
      } catch (error) {
        clearTimeout(timer);
        return {
          index,
          evidence: null,
          failure: Object.freeze({
            adapter: label,
            timeout: /timeout/i.test(error.message),
            reason: error.message,
          }),
        };
      }
    }),
  );

  const evidences = settled
    .filter(({ evidence }) => evidence !== null)
    .map(({ evidence }) => evidence);
  const failures = settled.filter(({ failure }) => failure !== null).map(({ failure }) => failure);
  const comparison = compareSolverEvidence(evidences);
  const indexed = settled.filter(({ evidence }) => evidence !== null);
  const eligible = indexed
    .filter(
      ({ evidence }) =>
        completeEvidence(evidence) && evidence.feasible === true && evidence.timeout === false,
    )
    .sort(
      (a, b) =>
        a.evidence.objective - b.evidence.objective ||
        a.evidence.runtimeMs - b.evidence.runtimeMs ||
        a.index - b.index,
    );
  const primary = eligible[0]?.evidence ?? null;
  const primaryComparisonIndex = primary ? evidences.indexOf(primary) : -1;
  const validationState = {
    simulationPassed: validation.simulationPassed === true,
    receiptValid: validation.receiptValid === true,
    provenanceValid: validation.provenanceValid === true,
  };
  const promotion = primary
    ? evaluatePromotionGate({ evidence: primary, validation: validationState })
    : Object.freeze({
        status: 'rejected',
        authoritative: false,
        checks: { evidenceComplete: false, feasible: false, ...validationState },
        reason: 'no candidate produced complete promotable evidence',
      });

  return Object.freeze({
    runnerVersion: RUNNER_VERSION,
    candidates: comparison,
    failures,
    selectedFingerprint:
      primaryComparisonIndex >= 0 ? comparison[primaryComparisonIndex].fingerprint : null,
    ranking: eligible.map(({ evidence }) => {
      const comparisonIndex = evidences.indexOf(evidence);
      return {
        rank: eligible.findIndex((entry) => entry.evidence === evidence) + 1,
        fingerprint: comparison[comparisonIndex].fingerprint,
        objective: evidence.objective,
        runtimeMs: evidence.runtimeMs,
      };
    }),
    promotion,
    authoritative: false,
  });
}

export { RUNNER_VERSION };

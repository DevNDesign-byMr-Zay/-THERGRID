import { compareSolverEvidence, evaluatePromotionGate } from './solver-evaluation.mjs';

const RUNNER_VERSION = 3;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export async function runSolverCandidates({ adapters, input, timeoutMs = 5000, validation = {} } = {}) {
  if (!Array.isArray(adapters) || adapters.length === 0) throw new TypeError('adapters must contain at least one adapter');
  object(input, 'input');
  object(validation, 'validation');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer');

  const evidences = [];
  const failures = [];
  const validationState = {
    simulationPassed: validation.simulationPassed === true,
    receiptValid: validation.receiptValid === true,
    provenanceValid: validation.provenanceValid === true,
  };

  for (const [index, adapter] of adapters.entries()) {
    object(adapter, `adapters[${index}]`);
    const identity = object(adapter.identity, `adapters[${index}].identity`);
    const label = `${text(identity.model, `adapters[${index}].identity.model`)}:${text(identity.solver, `adapters[${index}].identity.solver`)}`;
    const started = Date.now();
    try {
      const result = await Promise.race([
        Promise.resolve(adapter.solve(input)),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`solver timeout after ${timeoutMs}ms`)), timeoutMs)),
      ]);
      object(result, `${label} evidence`);
      evidences.push(Object.freeze({ ...result, runtimeMs: Number.isFinite(result.runtimeMs) ? result.runtimeMs : Date.now() - started }));
    } catch (error) {
      failures.push(Object.freeze({ adapter: label, timeout: /timeout/i.test(error.message), reason: error.message }));
    }
  }

  const comparison = compareSolverEvidence(evidences);
  const eligible = evidences
    .map((evidence, index) => ({ evidence, index }))
    .filter(({ evidence }) => evidence.feasible === true && evidence.timeout === false)
    .sort((a, b) => a.evidence.objective - b.evidence.objective || a.evidence.runtimeMs - b.evidence.runtimeMs || a.index - b.index);
  const primary = eligible[0]?.evidence ?? null;
  const primaryIndex = eligible[0]?.index ?? -1;
  const promotion = primary
    ? evaluatePromotionGate({ evidence: primary, validation: validationState })
    : Object.freeze({ status: 'rejected', authoritative: false, checks: { evidenceComplete: false, feasible: false, ...validationState }, reason: 'no candidate produced promotable evidence' });

  return Object.freeze({ runnerVersion: RUNNER_VERSION, candidates: comparison, failures, selectedFingerprint: primaryIndex >= 0 ? comparison[primaryIndex].fingerprint : null, ranking: eligible.map(({ index, evidence }) => ({ rank: eligible.findIndex((entry) => entry.index === index) + 1, fingerprint: comparison[index].fingerprint, objective: evidence.objective, runtimeMs: evidence.runtimeMs })), promotion, authoritative: false });
}

export { RUNNER_VERSION };

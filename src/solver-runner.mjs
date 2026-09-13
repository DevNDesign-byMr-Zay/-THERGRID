import { compareSolverEvidence, evaluatePromotionGate } from './solver-evaluation.mjs';

const RUNNER_VERSION = 2;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

export async function runSolverCandidates({
  adapters,
  input,
  timeoutMs = 5000,
  simulationPassed = false,
  receiptValid = false,
  provenanceValid = false,
} = {}) {
  if (!Array.isArray(adapters) || adapters.length === 0) throw new TypeError('adapters must contain at least one adapter');
  object(input, 'input');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer');

  const evidences = [];
  const failures = [];
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
  const primaryIndex = evidences.findIndex((evidence) => evidence.feasible && !evidence.timeout);
  const primary = primaryIndex >= 0 ? evidences[primaryIndex] : null;
  const promotion = primary
    ? evaluatePromotionGate({ evidence: primary, simulationPassed, receiptValid, provenanceValid })
    : Object.freeze({
        status: 'rejected',
        authoritative: false,
        checks: { evidenceComplete: false, feasible: false, simulationPassed: simulationPassed === true, receiptValid: receiptValid === true, provenanceValid: provenanceValid === true },
        reason: 'no candidate produced promotable evidence',
      });

  return Object.freeze({
    runnerVersion: RUNNER_VERSION,
    candidates: comparison,
    failures,
    selectedFingerprint: primaryIndex >= 0 ? comparison[primaryIndex].fingerprint : null,
    promotion,
    authoritative: false,
  });
}

export { RUNNER_VERSION };

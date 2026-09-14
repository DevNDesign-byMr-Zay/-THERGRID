import { validateSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';

const SEVERITIES = Object.freeze(['info', 'warning', 'critical']);

/** Project validated SOLVÆR evidence into an operator-only attention layer. */
export function buildSolvaerOperatorAttention({ evidence, decision } = {}) {
  if (!validateSolvaerCollaborationEvidence(evidence)) throw new TypeError('invalid SOLVÆR collaboration evidence');
  if (!decision || typeof decision !== 'object') throw new TypeError('decision is required');
  if (decision.experimentId !== evidence.experimentId) throw new TypeError('decision experiment does not match evidence');
  if (decision.requestId == null) throw new TypeError('decision requestId is required');

  const simulationPassed = decision.simulation?.status === 'passed';
  const items = [
    {
      id: `${evidence.experimentId}:simulation`,
      priority: simulationPassed ? 40 : 90,
      severity: simulationPassed ? 'info' : 'critical',
      reason: simulationPassed ? 'SOLVÆR candidate completed the THERGRID simulation gate.' : 'SOLVÆR candidate did not pass the THERGRID simulation gate.',
      evidenceRef: evidence.evidenceFingerprint,
      advisoryOnly: true,
    },
    {
      id: `${evidence.experimentId}:promotion`,
      priority: 70,
      severity: 'warning',
      reason: 'Candidate remains simulation-evidence-required and is not promotion-authoritative.',
      evidenceRef: evidence.evidenceFingerprint,
      advisoryOnly: true,
    },
  ];

  return Object.freeze({
    version: 1,
    experimentId: evidence.experimentId,
    snapshotId: evidence.snapshotId,
    requestId: decision.requestId,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
    safety: Object.freeze({ authoritative: false, actuatesHardware: false, advisoryOnly: true }),
  });
}

export function validateSolvaerOperatorAttention(attention) {
  try {
    if (!attention || attention.version !== 1 || !Array.isArray(attention.items)) return false;
    if (typeof attention.experimentId !== 'string' || !attention.experimentId.trim()
      || typeof attention.snapshotId !== 'string' || !attention.snapshotId.trim()
      || typeof attention.requestId !== 'string' || !attention.requestId.trim()) return false;
    if (!attention.safety || attention.safety.authoritative !== false || attention.safety.actuatesHardware !== false || attention.safety.advisoryOnly !== true) return false;
    return attention.items.every((item) => Number.isInteger(item.priority) && item.priority >= 0 && SEVERITIES.includes(item.severity) && item.advisoryOnly === true && typeof item.evidenceRef === 'string' && item.evidenceRef.trim().length > 0);
  } catch {
    return false;
  }
}

export { SEVERITIES as SOLVAER_OPERATOR_ATTENTION_SEVERITIES };

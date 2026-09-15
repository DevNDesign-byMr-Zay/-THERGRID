import { createHash } from 'node:crypto';
import { validateSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';

const SEVERITIES = Object.freeze(['info', 'warning', 'critical']);
const ATTENTION_VERSION = 2;

function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

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

  const attention = {
    version: ATTENTION_VERSION,
    experimentId: evidence.experimentId,
    snapshotId: evidence.snapshotId,
    requestId: decision.requestId,
    items,
    safety: { authoritative: false, actuatesHardware: false, advisoryOnly: true },
  };
  return Object.freeze({ ...attention, items: Object.freeze(items.map((item) => Object.freeze(item))), attentionFingerprint: fingerprint(attention) });
}

export function validateSolvaerOperatorAttention(attention) {
  try {
    const value = plainObject(attention, 'attention');
    if (!Object.hasOwn(value, 'version') || value.version !== ATTENTION_VERSION || !Array.isArray(value.items)) return false;
    if (!Object.hasOwn(value, 'experimentId') || !Object.hasOwn(value, 'snapshotId') || !Object.hasOwn(value, 'requestId')) return false;
    if (typeof value.experimentId !== 'string' || !value.experimentId.trim()
      || typeof value.snapshotId !== 'string' || !value.snapshotId.trim()
      || typeof value.requestId !== 'string' || !value.requestId.trim()) return false;
    const safety = value.safety;
    if (!safety || typeof safety !== 'object' || Array.isArray(safety) || Object.getPrototypeOf(safety) !== Object.prototype
      || !Object.hasOwn(safety, 'authoritative') || !Object.hasOwn(safety, 'actuatesHardware') || !Object.hasOwn(safety, 'advisoryOnly')
      || safety.authoritative !== false || safety.actuatesHardware !== false || safety.advisoryOnly !== true) return false;
    if (!Object.hasOwn(value, 'attentionFingerprint') || !/^[a-f0-9]{64}$/.test(value.attentionFingerprint)) return false;
    if (!value.items.every((item) => item && typeof item === 'object' && !Array.isArray(item) && Object.getPrototypeOf(item) === Object.prototype
      && Object.hasOwn(item, 'id') && Object.hasOwn(item, 'priority') && Object.hasOwn(item, 'severity')
      && Object.hasOwn(item, 'advisoryOnly') && Object.hasOwn(item, 'evidenceRef')
      && typeof item.id === 'string' && item.id.trim() && Number.isInteger(item.priority) && item.priority >= 0
      && SEVERITIES.includes(item.severity) && item.advisoryOnly === true && typeof item.evidenceRef === 'string' && item.evidenceRef.trim().length > 0)) return false;
    return value.attentionFingerprint === fingerprint({ ...value, attentionFingerprint: undefined });
  } catch {
    return false;
  }
}

export { ATTENTION_VERSION as SOLVAER_OPERATOR_ATTENTION_VERSION, SEVERITIES as SOLVAER_OPERATOR_ATTENTION_SEVERITIES };

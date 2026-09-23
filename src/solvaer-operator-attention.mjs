import { createHash } from 'node:crypto';
import { validateSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import { validateSolvaerOperatorEvidenceSummary } from './solvaer-operator-evidence-summary.mjs';

const ATTENTION_VERSION = 2;
const SEVERITIES = Object.freeze(['info', 'warning', 'critical']);
const ATTENTION_KEYS = Object.freeze([
  'version',
  'experimentId',
  'snapshotId',
  'requestId',
  'items',
  'safety',
  'attentionFingerprint',
]);
const ITEM_KEYS = Object.freeze([
  'id',
  'priority',
  'severity',
  'reason',
  'evidenceRef',
  'advisoryOnly',
]);
const SAFETY_KEYS = Object.freeze(['authoritative', 'actuatesHardware', 'advisoryOnly']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function snapshotAttentionEvidence(value, path = 'attention', seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} numbers must be finite`);
    return value;
  }
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${path} must contain JSON-compatible evidence`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  if (seen.has(value)) throw new TypeError(`${path} must not contain circular references`);
  seen.add(value);

  let copy;
  if (Array.isArray(value)) {
    const allowedKeys = new Set(['length']);
    copy = [];
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      allowedKeys.add(key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) throw new TypeError(`${path} must not contain sparse arrays`);
      if ('get' in descriptor || 'set' in descriptor) {
        throw new TypeError(`${path}[${index}] must not use accessors`);
      }
      copy.push(snapshotAttentionEvidence(descriptor.value, `${path}[${index}]`, seen));
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
      throw new TypeError(`${path} arrays must not contain extra properties`);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must use plain objects`);
    }
    copy = {};
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) throw new TypeError(`${path}.${key} must be enumerable evidence`);
      if ('get' in descriptor || 'set' in descriptor) {
        throw new TypeError(`${path}.${key} must not use accessors`);
      }
      Object.defineProperty(copy, key, {
        value: snapshotAttentionEvidence(descriptor.value, `${path}.${key}`, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  seen.delete(value);
  return copy;
}

function hasExactKeys(value, expectedKeys) {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function createOperatorAttention({
  experimentId,
  snapshotId,
  requestId,
  evidenceRef,
  simulationPassed,
}) {
  const items = [
    {
      id: `${experimentId}:simulation`,
      priority: simulationPassed ? 40 : 90,
      severity: simulationPassed ? 'info' : 'critical',
      reason: simulationPassed
        ? 'SOLVÆR candidate completed the THERGRID simulation gate.'
        : 'SOLVÆR candidate did not pass the THERGRID simulation gate.',
      evidenceRef,
      advisoryOnly: true,
    },
    {
      id: `${experimentId}:promotion`,
      priority: 70,
      severity: 'warning',
      reason: 'Candidate remains simulation-evidence-required and is not promotion-authoritative.',
      evidenceRef,
      advisoryOnly: true,
    },
  ];
  const body = {
    version: ATTENTION_VERSION,
    experimentId,
    snapshotId,
    requestId,
    items: Object.freeze(items.map((item) => Object.freeze(item))),
    safety: Object.freeze({ authoritative: false, actuatesHardware: false, advisoryOnly: true }),
  };

  return Object.freeze({
    ...body,
    attentionFingerprint: fingerprint(body),
  });
}

/** Project validated SOLVÆR collaboration evidence into an operator-only attention layer. */
export function buildSolvaerOperatorAttention({ evidence, decision } = {}) {
  if (!validateSolvaerCollaborationEvidence(evidence)) {
    throw new TypeError('invalid SOLVÆR collaboration evidence');
  }
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new TypeError('decision is required');
  }
  const decisionPrototype = Object.getPrototypeOf(decision);
  if (decisionPrototype !== Object.prototype) {
    throw new TypeError('decision must use a plain object');
  }
  for (const key of ['experimentId', 'requestId']) {
    const descriptor = Object.getOwnPropertyDescriptor(decision, key);
    if (!descriptor || 'get' in descriptor || 'set' in descriptor) {
      throw new TypeError(`decision.${key} must be an own data property`);
    }
  }
  if (decision.experimentId !== evidence.experimentId) {
    throw new TypeError('decision experiment does not match evidence');
  }
  if (typeof decision.requestId !== 'string' || !decision.requestId.trim()) {
    throw new TypeError('decision requestId is required');
  }
  if (decision.requestId !== evidence.requestId) {
    throw new TypeError('decision requestId does not match collaboration evidence');
  }

  let simulationStatus;
  const simulationDescriptor = Object.getOwnPropertyDescriptor(decision, 'simulation');
  if (simulationDescriptor) {
    if ('get' in simulationDescriptor || 'set' in simulationDescriptor) {
      throw new TypeError('decision.simulation must not use accessors');
    }
    const simulation = simulationDescriptor.value;
    if (simulation != null) {
      if (!simulation || typeof simulation !== 'object' || Array.isArray(simulation)) {
        throw new TypeError('decision.simulation must be a plain object');
      }
      if (Object.getPrototypeOf(simulation) !== Object.prototype) {
        throw new TypeError('decision.simulation must use a plain object');
      }
      const statusDescriptor = Object.getOwnPropertyDescriptor(simulation, 'status');
      if (statusDescriptor && ('get' in statusDescriptor || 'set' in statusDescriptor)) {
        throw new TypeError('decision.simulation.status must not use accessors');
      }
      simulationStatus = statusDescriptor?.value;
    }
  }

  return createOperatorAttention({
    experimentId: evidence.experimentId,
    snapshotId: evidence.snapshotId,
    requestId: decision.requestId,
    evidenceRef: evidence.evidenceFingerprint,
    simulationPassed: simulationStatus === 'passed',
  });
}

/** Build attention from the already allowlisted, integrity-checked operator evidence summary. */
export function buildSolvaerOperatorAttentionFromSummary(summary) {
  if (!validateSolvaerOperatorEvidenceSummary(summary)) {
    throw new TypeError('validated SOLVÆR operator evidence summary is required');
  }

  return createOperatorAttention({
    experimentId: summary.experimentId,
    snapshotId: summary.snapshotId,
    requestId: summary.solvaerRequestId,
    evidenceRef: summary.summaryFingerprint,
    simulationPassed: summary.simulationStatus === 'passed',
  });
}

export function validateSolvaerOperatorAttention(attention) {
  try {
    const normalized = snapshotAttentionEvidence(attention);
    if (!hasExactKeys(normalized, ATTENTION_KEYS)) return false;
    if (normalized.version !== ATTENTION_VERSION || !Array.isArray(normalized.items)) return false;
    if (
      typeof normalized.experimentId !== 'string' ||
      !normalized.experimentId.trim() ||
      typeof normalized.snapshotId !== 'string' ||
      !normalized.snapshotId.trim() ||
      typeof normalized.requestId !== 'string' ||
      !normalized.requestId.trim()
    ) {
      return false;
    }
    if (!hasExactKeys(normalized.safety, SAFETY_KEYS)) return false;
    if (
      normalized.safety.authoritative !== false ||
      normalized.safety.actuatesHardware !== false ||
      normalized.safety.advisoryOnly !== true
    ) {
      return false;
    }
    if (normalized.items.length !== 2) return false;
    if (
      !normalized.items.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          hasExactKeys(item, ITEM_KEYS) &&
          Number.isInteger(item.priority) &&
          item.priority >= 0 &&
          SEVERITIES.includes(item.severity) &&
          item.advisoryOnly === true &&
          typeof item.reason === 'string' &&
          item.reason.trim().length > 0 &&
          typeof item.evidenceRef === 'string' &&
          item.evidenceRef.trim().length > 0,
      )
    ) {
      return false;
    }
    if (normalized.items[0].id !== `${normalized.experimentId}:simulation`) return false;
    if (normalized.items[1].id !== `${normalized.experimentId}:promotion`) return false;
    if (normalized.items[0].evidenceRef !== normalized.items[1].evidenceRef) return false;
    if (typeof normalized.attentionFingerprint !== 'string') return false;
    if (!/^[a-f0-9]{64}$/.test(normalized.attentionFingerprint)) return false;

    const { attentionFingerprint, ...body } = normalized;
    return attentionFingerprint === fingerprint(body);
  } catch {
    return false;
  }
}

export {
  ATTENTION_VERSION as SOLVAER_OPERATOR_ATTENTION_VERSION,
  SEVERITIES as SOLVAER_OPERATOR_ATTENTION_SEVERITIES,
};

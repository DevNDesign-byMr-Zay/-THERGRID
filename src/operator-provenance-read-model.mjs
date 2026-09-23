import { createHash } from 'node:crypto';
import { validateProvenanceGraph } from './provenance.mjs';
import { validateSolvaerOperatorAttention } from './solvaer-operator-attention.mjs';

const OPERATOR_PROVENANCE_READ_MODEL_VERSION = 1;
const VIEW_KEYS = Object.freeze([
  'version',
  'experimentId',
  'snapshotId',
  'requestId',
  'attentionFingerprint',
  'provenanceNodeId',
  'provenanceContractVersion',
  'items',
  'interpretation',
  'safety',
  'viewFingerprint',
]);
const ITEM_KEYS = Object.freeze(['id', 'priority', 'severity', 'reason', 'evidenceRef']);
const SAFETY_KEYS = Object.freeze([
  'advisoryOnly',
  'authoritative',
  'actuatesHardware',
  'promotionEligible',
]);

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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function readExactDataObject(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return null;
  }

  const copy = {};
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return null;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function readItems(value) {
  if (!Array.isArray(value)) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const allowedKeys = new Set(['length']);
  const items = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || 'get' in descriptor || 'set' in descriptor) return null;
    const item = readExactDataObject(descriptor.value, ITEM_KEYS);
    if (!item) return null;
    items.push(item);
  }
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
    return null;
  }
  return items;
}

function validatedAttentionNode(graph, attention) {
  if (!validateSolvaerOperatorAttention(attention)) {
    throw new TypeError('sealed operator attention is required');
  }
  if (!validateProvenanceGraph(graph, { requiredTypes: ['operator-attention'] })) {
    throw new TypeError('validated operator-attention provenance is required');
  }
  if (graph.experimentId !== attention.experimentId) {
    throw new TypeError('provenance experiment does not match operator attention');
  }

  const nodes = graph.nodes.filter((node) => node.type === 'operator-attention');
  if (nodes.length !== 1) {
    throw new TypeError('exactly one operator-attention provenance node is required');
  }
  const node = nodes[0];
  if (node.sourceFingerprint !== attention.attentionFingerprint) {
    throw new TypeError('operator attention is not anchored to the provenance node');
  }
  return node;
}

function viewBody({ graph, attention }) {
  const node = validatedAttentionNode(graph, attention);
  const items = attention.items.map((item) =>
    Object.freeze({
      id: item.id,
      priority: item.priority,
      severity: item.severity,
      reason: item.reason,
      evidenceRef: item.evidenceRef,
    }),
  );

  return deepFreeze({
    version: OPERATOR_PROVENANCE_READ_MODEL_VERSION,
    experimentId: attention.experimentId,
    snapshotId: attention.snapshotId,
    requestId: attention.requestId,
    attentionFingerprint: attention.attentionFingerprint,
    provenanceNodeId: node.id,
    provenanceContractVersion: graph.contractVersion,
    items,
    interpretation: 'operator-evidence-read-only',
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
      promotionEligible: false,
    },
  });
}

export function createOperatorProvenanceReadModel({ graph, attention } = {}) {
  const body = viewBody({ graph, attention });
  return deepFreeze({
    ...body,
    viewFingerprint: fingerprint(body),
  });
}

export function validateOperatorProvenanceReadModel(view, { graph, attention } = {}) {
  try {
    const values = readExactDataObject(view, VIEW_KEYS);
    if (!values) return false;
    if (values.version !== OPERATOR_PROVENANCE_READ_MODEL_VERSION) return false;
    if (values.interpretation !== 'operator-evidence-read-only') return false;
    if (
      typeof values.viewFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(values.viewFingerprint)
    ) {
      return false;
    }

    const safety = readExactDataObject(values.safety, SAFETY_KEYS);
    if (!safety) return false;
    if (
      safety.advisoryOnly !== true ||
      safety.authoritative !== false ||
      safety.actuatesHardware !== false ||
      safety.promotionEligible !== false
    ) {
      return false;
    }

    const items = readItems(values.items);
    if (!items || items.length === 0) return false;

    const expected = viewBody({ graph, attention });
    const actualBody = {
      ...values,
      items,
      safety,
    };
    delete actualBody.viewFingerprint;
    return (
      JSON.stringify(canonical(actualBody)) === JSON.stringify(canonical(expected)) &&
      values.viewFingerprint === fingerprint(expected)
    );
  } catch {
    return false;
  }
}

export { OPERATOR_PROVENANCE_READ_MODEL_VERSION };

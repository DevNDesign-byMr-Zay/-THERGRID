import { createHash } from 'node:crypto';
import { validateSolvaerOperatorAttention } from './solvaer-operator-attention.mjs';

const PROVENANCE_VERSION = 2;
const GRAPH_KEYS = Object.freeze(['contractVersion', 'experimentId', 'nodes', 'edges']);
const NODE_KEYS = Object.freeze(['type', 'id']);
const OPERATOR_ATTENTION_NODE_KEYS = Object.freeze(['type', 'id', 'sourceFingerprint']);
const EDGE_KEYS = Object.freeze(['from', 'to']);

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

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readExactDataObject(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Object.keys(descriptors).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpected.length ||
    actualKeys.some((key, index) => key !== sortedExpected[index])
  ) {
    return null;
  }

  const copy = {};
  for (const key of sortedExpected) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return null;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function readExactArray(value, readEntry) {
  if (!Array.isArray(value)) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const allowedKeys = new Set(['length']);
  const entries = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || 'get' in descriptor || 'set' in descriptor) return null;
    const entry = readEntry(descriptor.value);
    if (!entry) return null;
    entries.push(entry);
  }
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
    return null;
  }
  return entries;
}

function readNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  const typeDescriptor = Object.getOwnPropertyDescriptor(value, 'type');
  if (
    !typeDescriptor ||
    !typeDescriptor.enumerable ||
    'get' in typeDescriptor ||
    'set' in typeDescriptor ||
    !nonEmptyText(typeDescriptor.value)
  ) {
    return null;
  }
  const expectedKeys =
    typeDescriptor.value === 'operator-attention' ? OPERATOR_ATTENTION_NODE_KEYS : NODE_KEYS;
  return readExactDataObject(value, expectedKeys);
}

function readEdge(value) {
  return readExactDataObject(value, EDGE_KEYS);
}

function artifactId(type, value) {
  const digest = createHash('sha256')
    .update(`${PROVENANCE_VERSION}:${type}:${JSON.stringify(canonical(value))}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `${type}-${digest}`;
}

function artifactNode(type, value) {
  if (type === 'operator-attention') {
    if (!validateSolvaerOperatorAttention(value)) {
      throw new TypeError('operator attention must be sealed before provenance projection');
    }
    return Object.freeze({
      type,
      id: `${type}-${value.attentionFingerprint.slice(0, 16)}`,
      sourceFingerprint: value.attentionFingerprint,
    });
  }
  return Object.freeze({ type, id: artifactId(type, value) });
}

export function fingerprintExperiment(input = {}) {
  const normalized = canonical({
    inputs: input.inputs ?? null,
    constraints: input.constraints ?? null,
    model: input.model ?? null,
    solver: input.solver ?? null,
    seed: input.seed ?? null,
  });
  return createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
}

export function buildProvenanceGraph({
  snapshot,
  twinState,
  forecast,
  proposal,
  simulation,
  receipt,
  scene,
  renderPacket = null,
  collaborationEvidence = null,
  operatorAttention = null,
  experimentId,
} = {}) {
  const artifacts = [
    ['telemetry', snapshot],
    ['twin-state', twinState],
    ['forecast', forecast],
    ['operating-proposal', proposal],
    ['simulation', simulation],
    ['decision-receipt', receipt],
    ['spatial-scene', scene],
    ['render-packet', renderPacket],
    ['solvaer-collaboration', collaborationEvidence],
    ['operator-attention', operatorAttention],
  ];

  const nodes = artifacts
    .filter(([, value]) => value != null)
    .map(([type, value]) => artifactNode(type, value));
  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }));

  return Object.freeze({
    contractVersion: PROVENANCE_VERSION,
    experimentId: experimentId ?? null,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

export function validateProvenanceGraph(graph, { requiredTypes = [] } = {}) {
  const values = readExactDataObject(graph, GRAPH_KEYS);
  if (!values) return false;
  if (values.contractVersion !== PROVENANCE_VERSION) return false;
  if (!nonEmptyText(values.experimentId)) return false;

  const nodes = readExactArray(values.nodes, readNode);
  const edges = readExactArray(values.edges, readEdge);
  if (!nodes || !edges) return false;
  if (!nodes.every((node) => nonEmptyText(node.type) && nonEmptyText(node.id))) return false;

  for (const node of nodes) {
    if (node.type !== 'operator-attention') continue;
    if (
      typeof node.sourceFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(node.sourceFingerprint)
    ) {
      return false;
    }
    if (node.id !== `operator-attention-${node.sourceFingerprint.slice(0, 16)}`) return false;
  }

  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) return false;
  if (
    !edges.every(
      (edge) =>
        nonEmptyText(edge.from) &&
        nonEmptyText(edge.to) &&
        edge.from !== edge.to &&
        ids.has(edge.from) &&
        ids.has(edge.to),
    )
  ) {
    return false;
  }

  if (edges.length !== Math.max(nodes.length - 1, 0)) return false;
  for (let index = 0; index < edges.length; index += 1) {
    if (edges[index].from !== nodes[index].id || edges[index].to !== nodes[index + 1].id) {
      return false;
    }
  }

  if (!Array.isArray(requiredTypes) || !requiredTypes.every(nonEmptyText)) return false;
  return requiredTypes.every((type) => nodes.some((node) => node.type === type));
}

export { PROVENANCE_VERSION };

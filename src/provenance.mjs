import { createHash } from 'node:crypto';

const PROVENANCE_VERSION = 2;

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

function artifactId(type, value) {
  const digest = createHash('sha256')
    .update(
      `${PROVENANCE_VERSION}:${type}:${JSON.stringify(canonical(value))}`,
      'utf8',
    )
    .digest('hex')
    .slice(0, 16);
  return `${type}-${digest}`;
}

export function fingerprintExperiment(input = {}) {
  const normalized = canonical({
    inputs: input.inputs ?? null,
    constraints: input.constraints ?? null,
    model: input.model ?? null,
    solver: input.solver ?? null,
    seed: input.seed ?? null,
  });
  return createHash('sha256')
    .update(JSON.stringify(normalized), 'utf8')
    .digest('hex');
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
  ];

  const nodes = artifacts
    .filter(([, value]) => value != null)
    .map(([type, value]) => ({ type, id: artifactId(type, value) }));
  const edges = nodes
    .slice(1)
    .map((node, index) => ({ from: nodes[index].id, to: node.id }));

  return Object.freeze({
    contractVersion: PROVENANCE_VERSION,
    experimentId: experimentId ?? null,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

export function validateProvenanceGraph(graph, { requiredTypes = [] } = {}) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    throw new TypeError('graph must be an object');
  }
  if (graph.contractVersion !== PROVENANCE_VERSION) return false;
  if (!nonEmptyText(graph.experimentId)) return false;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false;

  if (
    !graph.nodes.every(
      (node) =>
        node &&
        typeof node === 'object' &&
        !Array.isArray(node) &&
        nonEmptyText(node.type) &&
        nonEmptyText(node.id),
    )
  ) {
    return false;
  }

  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.size !== graph.nodes.length) return false;

  if (
    !graph.edges.every(
      (edge) =>
        edge &&
        typeof edge === 'object' &&
        !Array.isArray(edge) &&
        nonEmptyText(edge.from) &&
        nonEmptyText(edge.to) &&
        edge.from !== edge.to &&
        ids.has(edge.from) &&
        ids.has(edge.to),
    )
  ) {
    return false;
  }

  if (!Array.isArray(requiredTypes) || !requiredTypes.every(nonEmptyText)) {
    return false;
  }
  return requiredTypes.every((type) =>
    graph.nodes.some((node) => node.type === type),
  );
}

export { PROVENANCE_VERSION };

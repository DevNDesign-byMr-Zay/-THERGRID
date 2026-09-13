import { createHash } from 'node:crypto';

const PROVENANCE_VERSION = 1;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
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

export function buildProvenanceGraph({ snapshot, twinState, forecast, proposal, simulation, receipt, scene } = {}) {
  const nodes = [
    ['telemetry', snapshot?.snapshotId],
    ['twin-state', twinState?.snapshotId],
    ['forecast', forecast?.forecastFor],
    ['operating-proposal', proposal?.strategy],
    ['simulation', simulation?.status],
    ['decision-receipt', receipt?.receiptId],
    ['spatial-scene', scene?.sceneId],
  ].filter(([, id]) => id !== undefined && id !== null).map(([type, id]) => ({ type, id: String(id) }));

  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }));
  return Object.freeze({ contractVersion: PROVENANCE_VERSION, nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

export { PROVENANCE_VERSION };

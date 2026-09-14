import { runSyntheticMicrogrid } from '../src/pipeline.mjs';
import { validateProvenanceGraph } from '../src/provenance.mjs';

const snapshot = {
  schemaVersion: 1,
  snapshotId: 'demo-microgrid-001',
  observedAt: '2026-01-01T00:00:00.000Z',
  assets: [
    { id: 'solar-1', kind: 'solar', powerKw: 12, capacityKw: 15 },
    { id: 'load-1', kind: 'load', powerKw: 10, flexible: true },
    {
      id: 'grid-1',
      kind: 'grid_interconnect',
      powerKw: -2,
      importLimitKw: 80,
      exportLimitKw: 40
    }
  ],
  topology: {
    nodes: ['node-a'],
    connections: [
      { assetId: 'solar-1', nodeId: 'node-a' },
      { assetId: 'load-1', nodeId: 'node-a' },
      { assetId: 'grid-1', nodeId: 'node-a' }
    ]
  }
};

const run = runSyntheticMicrogrid(snapshot);
const provenanceValid = validateProvenanceGraph(run.provenance, {
  requiredTypes: [
    'telemetry',
    'twin-state',
    'forecast',
    'operating-proposal',
    'simulation',
    'decision-receipt',
    'spatial-scene',
    'render-packet'
  ]
});

if (run.simulation.status !== 'passed') {
  throw new Error(`demo simulation failed: ${run.simulation.status}`);
}
if (!provenanceValid) {
  throw new Error('demo provenance graph failed validation');
}
if (run.promotion.authoritative !== false) {
  throw new Error('demo promotion gate must remain non-authoritative');
}

const summary = {
  snapshotId: snapshot.snapshotId,
  experimentId: run.experimentId,
  simulationStatus: run.simulation.status,
  receiptId: run.receipt.receiptId,
  sceneId: run.scene.sceneId,
  renderTarget: run.renderPacket.target,
  provenanceValid,
  promotionStatus: run.promotion.status,
  authoritative: run.promotion.authoritative,
  solvaerHandoff: run.solvaerRequest.safety.advisoryOnly ? 'advisory-only' : 'invalid'
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

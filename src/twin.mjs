import { validateGridSnapshot } from './contracts.mjs';

export function deriveTwinState(input) {
  const snapshot = validateGridSnapshot(input);

  const generationAssets = snapshot.assets.filter(
    (asset) => asset.kind === 'solar' || asset.kind === 'wind',
  );
  const loadAssets = snapshot.assets.filter((asset) => asset.kind === 'load');
  const batteryAssets = snapshot.assets.filter((asset) => asset.kind === 'battery');
  const gridAssets = snapshot.assets.filter((asset) => asset.kind === 'grid_interconnect');

  const generationKw = sum(generationAssets.map((asset) => asset.powerKw));
  const loadKw = sum(loadAssets.map((asset) => asset.powerKw));
  const batteryKw = sum(batteryAssets.map((asset) => asset.powerKw));
  const gridKw = sum(gridAssets.map((asset) => asset.powerKw));
  const balanceKw = round(generationKw + batteryKw + gridKw - loadKw);

  const storage = batteryAssets.map((asset) => ({
    assetId: asset.id,
    capacityKwh: asset.capacityKwh,
    stateOfChargeKwh: asset.stateOfChargeKwh,
    stateOfChargePercent: round((asset.stateOfChargeKwh / asset.capacityKwh) * 100),
    powerKw: asset.powerKw,
    mode: asset.powerKw > 0 ? 'discharging' : asset.powerKw < 0 ? 'charging' : 'idle',
  }));

  const nodeByAssetId = new Map(
    snapshot.topology.connections.map(({ assetId, nodeId }) => [assetId, nodeId]),
  );
  const assetStates = snapshot.assets.map((asset) => ({
    assetId: asset.id,
    nodeId: nodeByAssetId.get(asset.id),
    kind: asset.kind,
    powerKw: asset.powerKw,
  }));

  return {
    schemaVersion: 1,
    snapshotId: snapshot.snapshotId,
    observedAt: snapshot.observedAt,
    topology: {
      nodeCount: snapshot.topology.nodes.length,
      connectionCount: snapshot.topology.connections.length,
      nodes: snapshot.topology.nodes.map((nodeId) => nodeId),
      assetNodeRefs: snapshot.topology.connections.map(({ assetId, nodeId }) => ({
        assetId,
        nodeId,
      })),
    },
    totals: {
      generationKw,
      loadKw,
      batteryKw,
      gridKw,
      balanceKw,
      renewableSharePercent: loadKw === 0 ? null : round((generationKw / loadKw) * 100),
    },
    assetStates,
    storage,
    balanced: Math.abs(balanceKw) < 0.001,
  };
}

function sum(values) {
  return round(values.reduce((total, value) => total + value, 0));
}

function round(value) {
  return Number(value.toFixed(6));
}

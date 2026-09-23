const ASSET_KINDS = new Set(['solar', 'wind', 'battery', 'load', 'grid_interconnect']);

export function validateGridSnapshot(input) {
  const snapshot = requireObject(input, 'snapshot');

  if (snapshot.schemaVersion !== 1) {
    throw new TypeError('snapshot.schemaVersion must equal 1');
  }

  const snapshotId = requireIdentifier(snapshot.snapshotId, 'snapshot.snapshotId');
  const observedAt = requireTimestamp(snapshot.observedAt, 'snapshot.observedAt');
  const assets = requireArray(snapshot.assets, 'snapshot.assets').map(validateAsset);

  if (assets.length === 0) {
    throw new TypeError('snapshot.assets must contain at least one asset');
  }

  const assetIds = new Set();
  for (const asset of assets) {
    if (assetIds.has(asset.id)) {
      throw new TypeError(`duplicate asset id: ${asset.id}`);
    }
    assetIds.add(asset.id);
  }

  const topology = validateTopology(snapshot.topology, assetIds);

  return {
    schemaVersion: 1,
    snapshotId,
    observedAt,
    assets,
    topology,
  };
}

function validateAsset(input, index) {
  const asset = requireObject(input, `snapshot.assets[${index}]`);
  const id = requireIdentifier(asset.id, `snapshot.assets[${index}].id`);
  const kind = requireString(asset.kind, `snapshot.assets[${index}].kind`);

  if (!ASSET_KINDS.has(kind)) {
    throw new TypeError(`snapshot.assets[${index}].kind is unsupported`);
  }

  const normalized = {
    id,
    kind,
    powerKw: requireFiniteNumber(asset.powerKw, `snapshot.assets[${index}].powerKw`),
  };

  if (kind === 'solar' || kind === 'wind') {
    normalized.capacityKw = requirePositiveNumber(
      asset.capacityKw,
      `snapshot.assets[${index}].capacityKw`,
    );

    if (normalized.powerKw < 0 || normalized.powerKw > normalized.capacityKw) {
      throw new TypeError(`snapshot.assets[${index}].powerKw must be within generation capacity`);
    }
  }

  if (kind === 'battery') {
    normalized.capacityKw = requirePositiveNumber(
      asset.capacityKw,
      `snapshot.assets[${index}].capacityKw`,
    );
    normalized.capacityKwh = requirePositiveNumber(
      asset.capacityKwh,
      `snapshot.assets[${index}].capacityKwh`,
    );
    normalized.stateOfChargeKwh = requireFiniteNumber(
      asset.stateOfChargeKwh,
      `snapshot.assets[${index}].stateOfChargeKwh`,
    );

    if (Math.abs(normalized.powerKw) > normalized.capacityKw) {
      throw new TypeError(`snapshot.assets[${index}].powerKw exceeds battery power capacity`);
    }
    if (normalized.stateOfChargeKwh < 0 || normalized.stateOfChargeKwh > normalized.capacityKwh) {
      throw new TypeError(`snapshot.assets[${index}].stateOfChargeKwh is outside battery capacity`);
    }
  }

  if (kind === 'load') {
    if (normalized.powerKw < 0) {
      throw new TypeError(`snapshot.assets[${index}].powerKw must be non-negative for a load`);
    }
    normalized.flexible = asset.flexible === true;
  }

  if (kind === 'grid_interconnect') {
    normalized.importLimitKw = requirePositiveNumber(
      asset.importLimitKw,
      `snapshot.assets[${index}].importLimitKw`,
    );
    normalized.exportLimitKw = requirePositiveNumber(
      asset.exportLimitKw,
      `snapshot.assets[${index}].exportLimitKw`,
    );

    if (normalized.powerKw > normalized.importLimitKw) {
      throw new TypeError(`snapshot.assets[${index}].powerKw exceeds grid import limit`);
    }
    if (normalized.powerKw < -normalized.exportLimitKw) {
      throw new TypeError(`snapshot.assets[${index}].powerKw exceeds grid export limit`);
    }
  }

  return normalized;
}

function validateTopology(input, assetIds) {
  const topology = requireObject(input, 'snapshot.topology');
  const nodes = requireArray(topology.nodes, 'snapshot.topology.nodes').map((nodeId, index) =>
    requireIdentifier(nodeId, `snapshot.topology.nodes[${index}]`),
  );

  if (nodes.length === 0) {
    throw new TypeError('snapshot.topology.nodes must contain at least one node');
  }

  const nodeIds = new Set();
  for (const nodeId of nodes) {
    if (nodeIds.has(nodeId)) {
      throw new TypeError(`duplicate topology node id: ${nodeId}`);
    }
    nodeIds.add(nodeId);
  }

  const connectedAssets = new Set();
  const connections = requireArray(topology.connections, 'snapshot.topology.connections').map(
    (inputConnection, index) => {
      const connection = requireObject(inputConnection, `snapshot.topology.connections[${index}]`);
      const assetId = requireIdentifier(
        connection.assetId,
        `snapshot.topology.connections[${index}].assetId`,
      );
      const nodeId = requireIdentifier(
        connection.nodeId,
        `snapshot.topology.connections[${index}].nodeId`,
      );

      if (!assetIds.has(assetId)) {
        throw new TypeError(`topology connection references unknown asset: ${assetId}`);
      }
      if (!nodeIds.has(nodeId)) {
        throw new TypeError(`topology connection references unknown node: ${nodeId}`);
      }
      if (connectedAssets.has(assetId)) {
        throw new TypeError(`asset has multiple topology connections: ${assetId}`);
      }

      connectedAssets.add(assetId);
      return { assetId, nodeId };
    },
  );

  for (const assetId of assetIds) {
    if (!connectedAssets.has(assetId)) {
      throw new TypeError(`asset is missing a topology connection: ${assetId}`);
    }
  }

  return { nodes, connections };
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requireIdentifier(value, name) {
  const identifier = requireString(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(identifier)) {
    throw new TypeError(`${name} contains unsupported characters`);
  }
  return identifier;
}

function requireTimestamp(value, name) {
  const timestamp = requireString(value, name);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${name} must be a valid timestamp`);
  }
  return new Date(parsed).toISOString();
}

function requireFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function requirePositiveNumber(value, name) {
  const number = requireFiniteNumber(value, name);
  if (number <= 0) {
    throw new TypeError(`${name} must be greater than zero`);
  }
  return number;
}

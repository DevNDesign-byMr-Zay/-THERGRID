function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requireFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function requirePositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function requireTwinState(value) {
  const twinState = requireObject(value, 'twinState');
  if (twinState.schemaVersion !== 1) {
    throw new TypeError('twinState.schemaVersion must be 1');
  }
  if (typeof twinState.snapshotId !== 'string' || !twinState.snapshotId.trim()) {
    throw new TypeError('twinState.snapshotId must be a non-empty string');
  }
  if (typeof twinState.observedAt !== 'string' || Number.isNaN(Date.parse(twinState.observedAt))) {
    throw new TypeError('twinState.observedAt must be an ISO timestamp');
  }
  requireObject(twinState.totals, 'twinState.totals');
  requireFiniteNumber(twinState.totals.generationKw, 'twinState.totals.generationKw');
  requireFiniteNumber(twinState.totals.loadKw, 'twinState.totals.loadKw');
  requireFiniteNumber(twinState.totals.batteryKw, 'twinState.totals.batteryKw');
  requireFiniteNumber(twinState.totals.gridKw, 'twinState.totals.gridKw');
  return twinState;
}

function round(value) {
  return Number(value.toFixed(6));
}

export function buildPersistenceForecast(twinStateInput, { horizonMinutes = 15 } = {}) {
  const twinState = requireTwinState(twinStateInput);
  const normalizedHorizon = requirePositiveInteger(horizonMinutes, 'horizonMinutes');
  const forecastFor = new Date(
    Date.parse(twinState.observedAt) + normalizedHorizon * 60 * 1000,
  ).toISOString();

  return {
    schemaVersion: 1,
    method: 'persistence-v1',
    snapshotId: twinState.snapshotId,
    observedAt: twinState.observedAt,
    forecastFor,
    horizonMinutes: normalizedHorizon,
    generationKw: twinState.totals.generationKw,
    loadKw: twinState.totals.loadKw,
  };
}

export function buildBaselineOperatingProposal(twinStateInput, forecastInput) {
  const twinState = requireTwinState(twinStateInput);
  const forecast = requireObject(forecastInput, 'forecast');

  if (forecast.schemaVersion !== 1 || forecast.method !== 'persistence-v1') {
    throw new TypeError('forecast must use the supported persistence-v1 contract');
  }
  if (forecast.snapshotId !== twinState.snapshotId) {
    throw new TypeError('forecast.snapshotId must match twinState.snapshotId');
  }

  const generationKw = requireFiniteNumber(forecast.generationKw, 'forecast.generationKw');
  const loadKw = requireFiniteNumber(forecast.loadKw, 'forecast.loadKw');
  const projectedBalanceKw = round(
    generationKw + twinState.totals.batteryKw + twinState.totals.gridKw - loadKw,
  );
  const gridAdjustmentKw = round(-projectedBalanceKw);
  const gridTargetKw = round(twinState.totals.gridKw + gridAdjustmentKw);

  return {
    schemaVersion: 1,
    strategy: 'balance-via-grid-v1',
    snapshotId: twinState.snapshotId,
    forecastFor: forecast.forecastFor,
    objective: 'close projected power imbalance while preserving current storage dispatch',
    inputs: {
      generationKw,
      loadKw,
      batteryKw: twinState.totals.batteryKw,
      currentGridKw: twinState.totals.gridKw,
    },
    projectedBalanceKw,
    action: {
      kind: 'grid_interchange_target',
      adjustmentKw: gridAdjustmentKw,
      targetKw: gridTargetKw,
    },
    advisoryOnly: true,
  };
}

const SIMULATION_VERSION = 2;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value;
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function simulateProposal({ twinState, proposal, durationMinutes = 15 } = {}) {
  const twin = requireObject(twinState, 'twinState');
  const decision = requireObject(proposal, 'proposal');
  if (decision.snapshotId !== twin.snapshotId)
    throw new TypeError('proposal.snapshotId must match twinState.snapshotId');
  if (decision.advisoryOnly !== true) throw new TypeError('proposal must remain advisory-only');
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0)
    throw new TypeError('durationMinutes must be a positive integer');

  const currentGridKw = finite(twin.totals.gridKw, 'twinState.totals.gridKw');
  const targetGridKw = finite(decision.action?.targetKw, 'proposal.action.targetKw');
  const projectedBalanceKw = finite(decision.projectedBalanceKw, 'proposal.projectedBalanceKw');
  const residualBalanceKw = Number(
    (projectedBalanceKw + (targetGridKw - currentGridKw)).toFixed(6),
  );
  const gridAdjustmentKw = Number((targetGridKw - currentGridKw).toFixed(6));

  return {
    schemaVersion: SIMULATION_VERSION,
    backend: 'thergrid-classical-reference-v1',
    deterministic: true,
    seed: 0,
    status: 'passed',
    runtimeMs: 0,
    snapshotId: twin.snapshotId,
    durationMinutes,
    inputs: { currentGridKw, targetGridKw, projectedBalanceKw },
    outputs: { residualBalanceKw, gridAdjustmentKw },
    safety: { physicalActuation: false, advisoryOnly: true },
  };
}

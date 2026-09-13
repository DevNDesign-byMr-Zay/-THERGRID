import { simulateProposal } from './simulation.mjs';
import {
  SOLVAER_OPTIMIZATION_CAPABILITY,
  SOLVAER_OPTIMIZATION_CONTRACT_VERSION,
} from './solvaer-optimization-contract.mjs';

const SOLVAER_SIMULATION_GATE_VERSION = 1;

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertAdvisoryHandoff(handoff) {
  if (
    handoff.safety?.advisoryOnly !== true ||
    handoff.safety?.authoritative !== false ||
    handoff.safety?.actuatesHardware !== false
  ) {
    throw new TypeError('SOLVÆR handoff must remain advisory and non-authoritative');
  }
}

/**
 * Consume an accepted SOLVÆR candidate through the deterministic classical
 * simulation boundary. A passing simulation remains non-promotable here;
 * policy validation and a later decision receipt are still required.
 */
export function simulateSolvaerOptimizationHandoff({
  handoff,
  twinState,
  twinStateRef,
  durationMinutes = 15,
} = {}) {
  const accepted = object(handoff, 'handoff');
  const twin = object(twinState, 'twinState');
  const resolvedTwinStateRef = text(twinStateRef, 'twinStateRef');

  if (accepted.contractVersion !== SOLVAER_OPTIMIZATION_CONTRACT_VERSION) {
    throw new TypeError('unsupported SOLVÆR contract version');
  }
  if (accepted.capability !== SOLVAER_OPTIMIZATION_CAPABILITY) {
    throw new TypeError('SOLVÆR handoff capability must be optimization.explore');
  }
  if (accepted.handoff !== 'simulation-required') {
    throw new TypeError('SOLVÆR handoff must require simulation');
  }
  assertAdvisoryHandoff(accepted);

  if (accepted.snapshotId !== twin.snapshotId) {
    throw new TypeError('SOLVÆR handoff snapshotId must match twinState.snapshotId');
  }
  if (accepted.twinStateRef !== resolvedTwinStateRef) {
    throw new TypeError('SOLVÆR handoff twinStateRef must match simulation twinStateRef');
  }

  const candidate = object(accepted.candidate, 'handoff.candidate');
  const targetGridKw = finite(candidate.targetGridKw, 'handoff.candidate.targetGridKw');
  const projectedBalanceKw = finite(
    candidate.projectedBalanceKw ?? twin.totals?.balanceKw,
    'handoff.candidate.projectedBalanceKw',
  );

  const simulation = simulateProposal({
    twinState: twin,
    proposal: {
      snapshotId: accepted.snapshotId,
      advisoryOnly: true,
      action: { targetKw: targetGridKw },
      projectedBalanceKw,
    },
    durationMinutes,
  });

  return deepFreeze({
    gateVersion: SOLVAER_SIMULATION_GATE_VERSION,
    experimentId: text(accepted.experimentId, 'handoff.experimentId'),
    snapshotId: accepted.snapshotId,
    twinStateRef: accepted.twinStateRef,
    objective: text(accepted.objective, 'handoff.objective'),
    constraints: accepted.constraints == null ? null : cloneValue(accepted.constraints),
    candidate: cloneValue(candidate),
    provenanceRef: cloneValue(object(accepted.provenanceRef, 'handoff.provenanceRef')),
    fallbackUsed: accepted.fallbackUsed === true,
    simulation: cloneValue(simulation),
    promotionAuthorized: false,
    nextGate: 'policy-validation',
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
      physicalActuation: false,
    },
  });
}

export { SOLVAER_SIMULATION_GATE_VERSION };

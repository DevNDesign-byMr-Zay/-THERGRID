import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';
import { simulateProposal } from './simulation.mjs';

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

function snapshot(value) {
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, snapshot(child)]),
    );
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Converts a SOLVÆR candidate into the only permitted execution boundary:
 * THERGRID simulation. No candidate is promoted or sent to infrastructure here.
 */
export function evaluateSolvaerCandidate({
  request,
  candidate,
  provenanceRef,
  twinState,
  twinStateRef,
  proposal,
} = {}) {
  const input = object(request, 'request');
  const state = object(twinState, 'twinState');
  const baseline = object(proposal, 'proposal');
  const resolvedTwinStateRef = text(
    twinStateRef ?? `twin-state:${state.snapshotId}`,
    'twinStateRef',
  );

  if (text(input.snapshotId, 'request.snapshotId') !== text(state.snapshotId, 'twinState.snapshotId')) {
    throw new TypeError('request snapshotId must match twinState.snapshotId');
  }
  if (text(input.twinStateRef, 'request.twinStateRef') !== resolvedTwinStateRef) {
    throw new TypeError('request twinStateRef must match simulation twin state');
  }

  const accepted = acceptSolvaerOptimizationResult({
    request: input,
    candidate,
    provenanceRef,
  });
  const simulation = simulateProposal({ twinState: state, proposal: baseline });

  return deepFreeze({
    request: snapshot(input),
    accepted,
    simulation: snapshot(simulation),
    promotionEligible: false,
    handoff: 'simulation-required',
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
    },
  });
}

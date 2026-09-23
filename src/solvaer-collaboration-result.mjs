import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function snapshot(value) {
  if (Array.isArray(value)) return value.map(snapshot);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshot(child)]));
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/** Normalize a SOLVÆR contribution before it enters THERGRID simulation. */
export function validateSolvaerCollaborationResult({
  request,
  candidate,
  provenanceRef,
  fallbackUsed = false,
} = {}) {
  const input = object(request, 'request');
  const result = acceptSolvaerOptimizationResult({
    request: input,
    candidate,
    provenanceRef,
    fallbackUsed,
  });
  const proposal = deepFreeze(snapshot(object(result.candidate.proposal, 'candidate.proposal')));
  const requestedObjective = text(input.objective, 'request.objective');
  if (
    result.candidate.objective != null &&
    text(result.candidate.objective, 'candidate.objective') !== requestedObjective
  ) {
    throw new TypeError('candidate objective must match request objective');
  }
  if (
    result.candidate.authoritative === true ||
    result.candidate.actuatesHardware === true ||
    result.candidate.physicalActuation === true
  ) {
    throw new TypeError('SOLVÆR candidate cannot claim authority or physical actuation');
  }

  return deepFreeze({
    contractVersion: result.contractVersion,
    capability: result.capability,
    requestId: result.requestId,
    experimentId: result.experimentId,
    snapshotId: result.snapshotId,
    twinStateRef: text(input.twinStateRef, 'request.twinStateRef'),
    objective: requestedObjective,
    constraints:
      input.constraints == null ? null : snapshot(object(input.constraints, 'request.constraints')),
    proposal,
    provenanceRef: snapshot(result.provenanceRef),
    producerIdentity: snapshot(result.producerIdentity),
    fallbackUsed: result.fallbackUsed === true,
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
    },
    handoff: 'simulation-required',
  });
}

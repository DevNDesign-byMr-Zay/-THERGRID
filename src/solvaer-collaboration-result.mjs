import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

/** Normalize a SOLVÆR contribution before it enters THERGRID simulation. */
export function validateSolvaerCollaborationResult({ request, candidate, provenanceRef } = {}) {
  const result = acceptSolvaerOptimizationResult({ request, candidate, provenanceRef });
  const proposal = object(result.candidate.proposal, 'candidate.proposal');
  const objective = result.candidate.objective == null ? null : text(result.candidate.objective, 'candidate.objective');
  if (result.candidate.authoritative === true || result.candidate.actuatesHardware === true || result.candidate.physicalActuation === true) {
    throw new TypeError('SOLVÆR candidate cannot claim authority or physical actuation');
  }
  return Object.freeze({
    contractVersion: result.contractVersion,
    experimentId: result.experimentId,
    snapshotId: result.snapshotId,
    proposal,
    objective,
    provenanceRef: result.provenanceRef,
    safety: Object.freeze({ advisoryOnly: true, authoritative: false, actuatesHardware: false }),
    handoff: 'simulation-required',
  });
}

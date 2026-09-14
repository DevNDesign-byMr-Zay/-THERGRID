import { validateSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import { acceptSolvaerOptimizationResult } from './solvaer-optimization-contract.mjs';
import { simulateProposal } from './simulation.mjs';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sameEvidence(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

/**
 * Converts a SOLVÆR candidate into the only permitted execution boundary:
 * THERGRID simulation. A validated collaboration-evidence receipt is mandatory;
 * no candidate is promoted or sent to infrastructure here.
 */
export function evaluateSolvaerCandidate({
  request,
  candidate,
  provenanceRef,
  collaborationEvidence,
  twinState,
  proposal,
} = {}) {
  const input = object(request, 'request');
  const state = object(twinState, 'twinState');
  const baseline = object(proposal, 'proposal');
  const evidence = object(collaborationEvidence, 'collaborationEvidence');

  if (!validateSolvaerCollaborationEvidence(evidence)) {
    throw new TypeError('validated SOLVÆR collaboration evidence is required before simulation');
  }

  const accepted = acceptSolvaerOptimizationResult({ request: input, candidate, provenanceRef });
  if (evidence.requestId !== accepted.requestId) {
    throw new TypeError('collaboration evidence requestId must match accepted request');
  }
  if (evidence.experimentId !== accepted.experimentId) {
    throw new TypeError('collaboration evidence experimentId must match accepted request');
  }
  if (evidence.snapshotId !== accepted.snapshotId) {
    throw new TypeError('collaboration evidence snapshotId must match accepted request');
  }
  if (evidence.capability !== accepted.capability) {
    throw new TypeError('collaboration evidence capability must match accepted request');
  }
  if (!sameEvidence(evidence.candidate, accepted.candidate)) {
    throw new TypeError('collaboration evidence candidate must match accepted candidate');
  }
  if (!sameEvidence(evidence.provenanceRef, accepted.provenanceRef)) {
    throw new TypeError('collaboration evidence provenance must match accepted provenance');
  }

  const simulation = simulateProposal({ twinState: state, proposal: baseline });
  const collaborationEvidenceRef = Object.freeze({
    evidenceFingerprint: evidence.evidenceFingerprint,
    requestId: evidence.requestId,
    experimentId: evidence.experimentId,
    snapshotId: evidence.snapshotId,
  });

  return Object.freeze({
    request: input,
    accepted,
    collaborationEvidenceRef,
    simulation,
    promotionEligible: false,
    handoff: 'simulation-required',
    safety: Object.freeze({ advisoryOnly: true, authoritative: false, actuatesHardware: false }),
  });
}

const CONTRACT_VERSION = 2;
const CAPABILITY = 'optimization.explore';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

/**
 * Defines the SOLVÆR optimization handoff without granting authority over
 * THERGRID simulation, promotion, or physical infrastructure.
 */
export function createSolvaerOptimizationRequest({ experimentId, snapshotId, twinStateRef, objective, constraints = null } = {}) {
  const normalizedSnapshotId = text(snapshotId, 'snapshotId');
  const normalizedTwinStateRef = text(twinStateRef, 'twinStateRef');
  if (normalizedTwinStateRef !== `twin-state:${normalizedSnapshotId}`) {
    throw new TypeError('twinStateRef must bind to snapshotId');
  }
  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    experimentId: text(experimentId, 'experimentId'),
    snapshotId: normalizedSnapshotId,
    twinStateRef: normalizedTwinStateRef,
    objective: text(objective, 'objective'),
    constraints: constraints == null ? null : object(constraints, 'constraints'),
    safety: { advisoryOnly: true, authoritative: false, actuatesHardware: false },
  });
}

export function acceptSolvaerOptimizationResult({ request, candidate, provenanceRef, fallbackUsed = false } = {}) {
  const input = object(request, 'request');
  const result = object(candidate, 'candidate');
  const provenance = object(provenanceRef, 'provenanceRef');
  if (input.contractVersion !== CONTRACT_VERSION) throw new TypeError('unsupported SOLVÆR contract version');
  if (input.capability !== CAPABILITY) throw new TypeError('request capability must be optimization.explore');
  if (input.twinStateRef !== `twin-state:${input.snapshotId}`) throw new TypeError('request twinStateRef must bind to snapshotId');
  if (input.experimentId !== text(provenance.experimentId, 'provenanceRef.experimentId')) {
    throw new TypeError('candidate experimentId must match request');
  }
  if (result.experimentId != null && text(result.experimentId, 'candidate.experimentId') !== input.experimentId) {
    throw new TypeError('candidate experimentId must match request');
  }
  if (result.snapshotId != null && text(result.snapshotId, 'candidate.snapshotId') !== input.snapshotId) {
    throw new TypeError('candidate snapshotId must match request');
  }
  if (provenance.snapshotId != null && text(provenance.snapshotId, 'provenanceRef.snapshotId') !== input.snapshotId) {
    throw new TypeError('provenance snapshotId must match request');
  }
  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    experimentId: input.experimentId,
    snapshotId: input.snapshotId,
    candidate: result,
    provenanceRef: provenance,
    fallbackUsed: fallbackUsed === true,
    safety: { advisoryOnly: true, authoritative: false, actuatesHardware: false },
    handoff: 'simulation-required',
  });
}

export { CONTRACT_VERSION as SOLVAER_OPTIMIZATION_CONTRACT_VERSION, CAPABILITY as SOLVAER_OPTIMIZATION_CAPABILITY };

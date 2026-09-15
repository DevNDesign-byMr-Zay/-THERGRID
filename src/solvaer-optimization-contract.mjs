const CONTRACT_VERSION = 2;
const CAPABILITY = 'optimization.explore';
const PRODUCER_IDENTITY = Object.freeze({
  family: 'SOLVÆR',
  role: 'optimization',
  contract: `solvaer:${CONTRACT_VERSION}`,
});

function object(value, name) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function sameIdentity(actual, expected) {
  return (
    actual != null &&
    typeof actual === 'object' &&
    !Array.isArray(actual) &&
    Object.getPrototypeOf(actual) === Object.prototype &&
    Object.hasOwn(actual, 'family') &&
    Object.hasOwn(actual, 'role') &&
    Object.hasOwn(actual, 'contract') &&
    actual.family === expected.family &&
    actual.role === expected.role &&
    actual.contract === expected.contract
  );
}

function rejectAuthority(value, name) {
  if (value == null) return;
  const safety = value.safety;
  if (safety == null) return;
  const normalizedSafety = object(safety, `${name}.safety`);
  if (
    normalizedSafety.authoritative === true ||
    normalizedSafety.actuatesHardware === true ||
    normalizedSafety.physicalActuation === true ||
    normalizedSafety.advisoryOnly === false
  ) {
    throw new TypeError(`${name} cannot carry physical or authoritative execution authority`);
  }
}

/**
 * Defines the SOLVÆR optimization handoff without granting authority over
 * THERGRID simulation, promotion, or physical infrastructure.
 */
export function createSolvaerOptimizationRequest({
  experimentId,
  snapshotId,
  twinStateRef,
  objective,
  constraints = null,
  requestId = null,
} = {}) {
  const normalizedExperimentId = text(experimentId, 'experimentId');
  const normalizedSnapshotId = text(snapshotId, 'snapshotId');
  const normalizedTwinStateRef = text(twinStateRef, 'twinStateRef');
  if (normalizedTwinStateRef !== `twin-state:${normalizedSnapshotId}`) {
    throw new TypeError('twinStateRef must bind to snapshotId');
  }
  const normalizedRequestId =
    requestId == null
      ? `solvaer-request:${normalizedExperimentId}:${normalizedSnapshotId}`
      : text(requestId, 'requestId');

  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    requestId: normalizedRequestId,
    experimentId: normalizedExperimentId,
    snapshotId: normalizedSnapshotId,
    twinStateRef: normalizedTwinStateRef,
    objective: text(objective, 'objective'),
    constraints: constraints == null ? null : object(constraints, 'constraints'),
    producerIdentity: PRODUCER_IDENTITY,
    safety: Object.freeze({ advisoryOnly: true, authoritative: false, actuatesHardware: false }),
  });
}

export function acceptSolvaerOptimizationResult({
  request,
  candidate,
  provenanceRef,
  fallbackUsed = false,
} = {}) {
  const input = object(request, 'request');
  const result = object(candidate, 'candidate');
  const provenance = object(provenanceRef, 'provenanceRef');

  if (input.contractVersion !== CONTRACT_VERSION) {
    throw new TypeError('unsupported SOLVÆR contract version');
  }
  if (input.capability !== CAPABILITY) {
    throw new TypeError('request capability must be optimization.explore');
  }
  const requestId = text(input.requestId, 'request.requestId');
  if (input.twinStateRef !== `twin-state:${input.snapshotId}`) {
    throw new TypeError('request twinStateRef must bind to snapshotId');
  }
  if (!sameIdentity(input.producerIdentity, PRODUCER_IDENTITY)) {
    throw new TypeError('request producer identity is invalid');
  }

  rejectAuthority(input, 'request');
  rejectAuthority(result, 'candidate');
  rejectAuthority(provenance, 'provenanceRef');

  if (input.experimentId !== text(provenance.experimentId, 'provenanceRef.experimentId')) {
    throw new TypeError('candidate experimentId must match request');
  }
  if (
    result.experimentId != null &&
    text(result.experimentId, 'candidate.experimentId') !== input.experimentId
  ) {
    throw new TypeError('candidate experimentId must match request');
  }
  if (
    result.snapshotId != null &&
    text(result.snapshotId, 'candidate.snapshotId') !== input.snapshotId
  ) {
    throw new TypeError('candidate snapshotId must match request');
  }
  if (
    provenance.snapshotId != null &&
    text(provenance.snapshotId, 'provenanceRef.snapshotId') !== input.snapshotId
  ) {
    throw new TypeError('provenance snapshotId must match request');
  }

  for (const [name, identity] of [
    ['candidate', result.producerIdentity],
    ['provenanceRef', provenance.producerIdentity],
  ]) {
    if (identity != null && !sameIdentity(identity, PRODUCER_IDENTITY)) {
      throw new TypeError(`${name} producer identity does not match SOLVÆR request`);
    }
  }

  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    requestId,
    experimentId: input.experimentId,
    snapshotId: input.snapshotId,
    candidate: result,
    provenanceRef: provenance,
    producerIdentity: PRODUCER_IDENTITY,
    fallbackUsed: fallbackUsed === true,
    safety: Object.freeze({ advisoryOnly: true, authoritative: false, actuatesHardware: false }),
    handoff: 'simulation-required',
  });
}

export {
  CONTRACT_VERSION as SOLVAER_OPTIMIZATION_CONTRACT_VERSION,
  CAPABILITY as SOLVAER_OPTIMIZATION_CAPABILITY,
  PRODUCER_IDENTITY as SOLVAER_PRODUCER_IDENTITY,
};

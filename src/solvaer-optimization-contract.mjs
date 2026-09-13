const CONTRACT_VERSION = 1;
const CAPABILITY = 'optimization.explore';

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

function safetyBoundary() {
  return Object.freeze({ advisoryOnly: true, authoritative: false, actuatesHardware: false });
}

function assertAdvisorySafety(safety, name) {
  const value = object(safety, name);
  if (
    value.advisoryOnly !== true ||
    value.authoritative !== false ||
    value.actuatesHardware !== false
  ) {
    throw new TypeError(`${name} must remain advisory and non-authoritative`);
  }
}

/**
 * Defines the future SOLVÆR optimization handoff without granting authority
 * over THERGRID simulation, promotion, or physical infrastructure.
 */
export function createSolvaerOptimizationRequest({
  experimentId,
  snapshotId,
  twinStateRef,
  objective,
  constraints = null,
} = {}) {
  const capturedConstraints =
    constraints == null ? null : cloneValue(object(constraints, 'constraints'));

  return deepFreeze({
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    experimentId: text(experimentId, 'experimentId'),
    snapshotId: text(snapshotId, 'snapshotId'),
    twinStateRef: text(twinStateRef, 'twinStateRef'),
    objective: text(objective, 'objective'),
    constraints: capturedConstraints,
    safety: safetyBoundary(),
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
  assertAdvisorySafety(input.safety, 'request.safety');

  const experimentId = text(provenance.experimentId, 'provenanceRef.experimentId');
  const snapshotId = text(provenance.snapshotId, 'provenanceRef.snapshotId');
  const twinStateRef = text(provenance.twinStateRef, 'provenanceRef.twinStateRef');
  if (input.experimentId !== experimentId) {
    throw new TypeError('candidate experimentId must match request');
  }
  if (input.snapshotId !== snapshotId) {
    throw new TypeError('candidate snapshotId must match request');
  }
  if (input.twinStateRef !== twinStateRef) {
    throw new TypeError('candidate twinStateRef must match request');
  }

  return deepFreeze({
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    experimentId: input.experimentId,
    snapshotId: input.snapshotId,
    twinStateRef: input.twinStateRef,
    objective: text(input.objective, 'request.objective'),
    constraints: input.constraints == null ? null : cloneValue(object(input.constraints, 'request.constraints')),
    candidate: cloneValue(result),
    provenanceRef: cloneValue(provenance),
    fallbackUsed: fallbackUsed === true,
    safety: safetyBoundary(),
    handoff: 'simulation-required',
  });
}

export {
  CONTRACT_VERSION as SOLVAER_OPTIMIZATION_CONTRACT_VERSION,
  CAPABILITY as SOLVAER_OPTIMIZATION_CAPABILITY,
};

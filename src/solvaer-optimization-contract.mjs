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

function validateSafetyBoundary(request) {
  if (
    request.safety?.advisoryOnly !== true ||
    request.safety?.authoritative !== false ||
    request.safety?.actuatesHardware !== false
  ) {
    throw new TypeError('SOLVÆR request safety boundary is invalid');
  }
}

function requireMatchingIdentity(value, field, expected, name) {
  if (text(value[field], `${name}.${field}`) !== expected) {
    throw new TypeError(`${name} ${field} must match request`);
  }
}

function validateOptionalIdentity(value, field, expected, name) {
  if (value[field] != null && text(value[field], `${name}.${field}`) !== expected) {
    throw new TypeError(`${name} ${field} must match request`);
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
  const request = {
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    experimentId: text(experimentId, 'experimentId'),
    snapshotId: text(snapshotId, 'snapshotId'),
    twinStateRef: text(twinStateRef, 'twinStateRef'),
    objective: text(objective, 'objective'),
    constraints:
      constraints == null ? null : snapshot(object(constraints, 'constraints')),
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
    },
  };
  return deepFreeze(request);
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
  validateSafetyBoundary(input);

  const experimentId = text(input.experimentId, 'request.experimentId');
  const snapshotId = text(input.snapshotId, 'request.snapshotId');
  const twinStateRef = text(input.twinStateRef, 'request.twinStateRef');
  const objective = text(input.objective, 'request.objective');

  requireMatchingIdentity(
    provenance,
    'experimentId',
    experimentId,
    'provenanceRef',
  );
  requireMatchingIdentity(
    provenance,
    'snapshotId',
    snapshotId,
    'provenanceRef',
  );
  requireMatchingIdentity(
    provenance,
    'twinStateRef',
    twinStateRef,
    'provenanceRef',
  );

  validateOptionalIdentity(result, 'experimentId', experimentId, 'candidate');
  validateOptionalIdentity(result, 'snapshotId', snapshotId, 'candidate');
  validateOptionalIdentity(result, 'twinStateRef', twinStateRef, 'candidate');

  const accepted = {
    contractVersion: CONTRACT_VERSION,
    capability: CAPABILITY,
    experimentId,
    snapshotId,
    twinStateRef,
    objective,
    constraints: snapshot(input.constraints ?? null),
    candidate: snapshot(result),
    provenanceRef: snapshot(provenance),
    fallbackUsed: fallbackUsed === true,
    safety: {
      advisoryOnly: true,
      authoritative: false,
      actuatesHardware: false,
    },
    handoff: 'simulation-required',
  };

  return deepFreeze(accepted);
}

export {
  CONTRACT_VERSION as SOLVAER_OPTIMIZATION_CONTRACT_VERSION,
  CAPABILITY as SOLVAER_OPTIMIZATION_CAPABILITY,
};

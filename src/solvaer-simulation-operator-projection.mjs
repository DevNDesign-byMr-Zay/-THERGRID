import { createHash } from 'node:crypto';
import { validateSolvaerSimulationEvidence } from './solvaer-simulation-evidence.mjs';

const PROJECTION_VERSION = 1;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function projectionBody(evidence) {
  const simulation = evidence.simulation;
  return {
    version: PROJECTION_VERSION,
    identity: {
      requestId: evidence.requestId,
      experimentId: evidence.experimentId,
      snapshotId: evidence.snapshotId,
    },
    evidenceRefs: {
      collaborationEvidenceFingerprint: evidence.collaborationEvidenceFingerprint,
      simulationEvidenceFingerprint: evidence.simulationEvidenceFingerprint,
    },
    simulation: {
      backend: simulation.backend,
      status: simulation.status,
      deterministic: simulation.deterministic,
      durationMinutes: simulation.durationMinutes,
      runtimeMs: simulation.runtimeMs,
    },
    metrics: {
      residualBalanceKw: simulation.outputs.residualBalanceKw,
      gridAdjustmentKw: simulation.outputs.gridAdjustmentKw,
    },
    interpretation: 'operator-review-only',
    promotionEligible: false,
    safety: {
      advisoryOnly: true,
      authoritative: false,
      deploysInfrastructure: false,
      dispatchesInfrastructure: false,
      promotesCandidate: false,
      actuatesHardware: false,
    },
  };
}

export function createSolvaerSimulationOperatorProjection({ evidence, source } = {}) {
  if (!validateSolvaerSimulationEvidence(evidence, source)) {
    throw new TypeError('validated SOLVÆR simulation evidence is required');
  }
  const body = projectionBody(evidence);
  return deepFreeze({
    ...body,
    projectionFingerprint: fingerprint(body),
  });
}

export function validateSolvaerSimulationOperatorProjection(projection, { evidence, source } = {}) {
  try {
    if (!validateSolvaerSimulationEvidence(evidence, source)) return false;
    if (!projection || typeof projection !== 'object' || Array.isArray(projection)) return false;
    if (!/^[a-f0-9]{64}$/.test(projection.projectionFingerprint)) return false;
    const expectedBody = projectionBody(evidence);
    const actualBody = Object.fromEntries(
      Object.entries(projection).filter(([key]) => key !== 'projectionFingerprint'),
    );
    if (JSON.stringify(canonical(actualBody)) !== JSON.stringify(canonical(expectedBody))) return false;
    return projection.projectionFingerprint === fingerprint(expectedBody);
  } catch {
    return false;
  }
}

export { PROJECTION_VERSION as SOLVAER_SIMULATION_OPERATOR_PROJECTION_VERSION };

import { createHash } from 'node:crypto';

import { SCENE_VERSION } from './spatial-scene.mjs';

const OPERATOR_PROJECTION_VERSION = 1;
const SUPPORTED_TARGETS = Object.freeze([
  'holo-mat',
  'projector',
  'volumetric-3d',
  'ar-vr',
  'web-dashboard',
]);

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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function fingerprintPayload(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}

function attentionFromHandoff(handoff) {
  const solver = object(handoff.solver, 'handoff.solver');

  if (solver.timeout === true) {
    return Object.freeze({
      id: 'solver-timeout',
      priority: 0,
      severity: 'critical',
      reason: 'solver evidence reports a timeout; operator review is required',
      evidenceRef: `solver-evidence:${text(handoff.solverEvidenceFingerprint, 'handoff.solverEvidenceFingerprint')}`,
      advisoryOnly: true,
    });
  }

  if (solver.feasible !== true) {
    return Object.freeze({
      id: 'solver-infeasible',
      priority: 1,
      severity: 'error',
      reason: 'solver candidate is not feasible and cannot be promoted from evidence alone',
      evidenceRef: `solver-evidence:${text(handoff.solverEvidenceFingerprint, 'handoff.solverEvidenceFingerprint')}`,
      advisoryOnly: true,
    });
  }

  if (solver.fallback != null) {
    return Object.freeze({
      id: 'solver-fallback',
      priority: 2,
      severity: 'warning',
      reason: `solver fallback used: ${text(solver.fallback, 'handoff.solver.fallback')}`,
      evidenceRef: `solver-evidence:${text(handoff.solverEvidenceFingerprint, 'handoff.solverEvidenceFingerprint')}`,
      advisoryOnly: true,
    });
  }

  return Object.freeze({
    id: 'solver-comparison-ready',
    priority: 3,
    severity: 'info',
    reason: 'validated solver evidence is ready for operator comparison',
    evidenceRef: `solver-evidence:${text(handoff.solverEvidenceFingerprint, 'handoff.solverEvidenceFingerprint')}`,
    advisoryOnly: true,
  });
}

function projectionFingerprintInput(projection) {
  const { projectionFingerprint: _projectionFingerprint, ...payload } = projection;
  return payload;
}

export function fingerprintOperatorAttentionProjection(projection) {
  return fingerprintPayload(projectionFingerprintInput(object(projection, 'projection')));
}

export function buildOperatorAttentionProjection({ scene, handoff, target } = {}) {
  const spatialScene = object(scene, 'scene');
  const evidenceHandoff = object(handoff, 'handoff');
  const snapshotId = text(spatialScene.snapshotId, 'scene.snapshotId');
  const handoffSnapshotId = text(evidenceHandoff.snapshotId, 'handoff.snapshotId');

  if (spatialScene.sceneVersion !== SCENE_VERSION) {
    throw new TypeError(`scene.sceneVersion must equal ${SCENE_VERSION}`);
  }
  if (snapshotId !== handoffSnapshotId) {
    throw new TypeError('scene.snapshotId must match handoff.snapshotId');
  }

  const resolvedTarget = text(target, 'target');
  const sceneTargets = spatialScene.rendererContract?.supportedTargets;
  if (!SUPPORTED_TARGETS.includes(resolvedTarget)) {
    throw new TypeError(`unsupported operator target: ${resolvedTarget}`);
  }
  if (!Array.isArray(sceneTargets) || !sceneTargets.includes(resolvedTarget)) {
    throw new TypeError('target must be supported by the spatial scene renderer contract');
  }

  if (
    evidenceHandoff.safety?.observationalOnly !== true ||
    evidenceHandoff.safety?.authoritative !== false ||
    evidenceHandoff.safety?.physicalActuation !== false
  ) {
    throw new TypeError('handoff safety boundary must remain observational and non-authoritative');
  }

  const routing = object(evidenceHandoff.routing, 'handoff.routing');
  const solver = object(evidenceHandoff.solver, 'handoff.solver');
  const attention = Object.freeze([attentionFromHandoff(evidenceHandoff)]);

  const payload = Object.freeze({
    projectionVersion: OPERATOR_PROJECTION_VERSION,
    sceneVersion: SCENE_VERSION,
    snapshotId,
    sceneId: text(spatialScene.sceneId, 'scene.sceneId'),
    provenanceRef: text(spatialScene.provenanceRef, 'scene.provenanceRef'),
    target: Object.freeze({
      name: resolvedTarget,
      rendererNeutral: true,
    }),
    decisionReceiptFingerprint: text(
      evidenceHandoff.decisionReceiptFingerprint,
      'handoff.decisionReceiptFingerprint',
    ),
    solverEvidenceFingerprint: text(
      evidenceHandoff.solverEvidenceFingerprint,
      'handoff.solverEvidenceFingerprint',
    ),
    routing: Object.freeze({
      model: text(routing.model, 'handoff.routing.model'),
      capability: text(routing.capability, 'handoff.routing.capability'),
      fallbackUsed: routing.fallbackUsed === true,
      fallbackIdentity: routing.fallbackIdentity ?? null,
    }),
    solver: Object.freeze({
      experimentId: text(solver.experimentId, 'handoff.solver.experimentId'),
      objective: solver.objective,
      feasible: solver.feasible === true,
      timeout: solver.timeout === true,
      fallback: solver.fallback ?? null,
      provenance: Object.freeze(Array.isArray(solver.provenance) ? [...solver.provenance] : []),
    }),
    attention,
    advisoryOnly: true,
    authoritative: false,
    physicalActuation: false,
  });

  return Object.freeze({
    ...payload,
    projectionFingerprint: fingerprintPayload(payload),
  });
}

export function validateOperatorAttentionProjection(projection) {
  const value = object(projection, 'projection');
  if (value.projectionVersion !== OPERATOR_PROJECTION_VERSION) {
    throw new TypeError(`projection.projectionVersion must equal ${OPERATOR_PROJECTION_VERSION}`);
  }
  if (value.sceneVersion !== SCENE_VERSION) {
    throw new TypeError(`projection.sceneVersion must equal ${SCENE_VERSION}`);
  }

  text(value.snapshotId, 'projection.snapshotId');
  text(value.sceneId, 'projection.sceneId');
  text(value.provenanceRef, 'projection.provenanceRef');
  const target = object(value.target, 'projection.target');
  const targetName = text(target.name, 'projection.target.name');
  if (!SUPPORTED_TARGETS.includes(targetName) || target.rendererNeutral !== true) {
    throw new TypeError('projection target must be renderer-neutral and supported');
  }

  if (
    value.advisoryOnly !== true ||
    value.authoritative !== false ||
    value.physicalActuation !== false
  ) {
    throw new TypeError('projection safety boundary must remain advisory-only');
  }

  if (!Array.isArray(value.attention) || value.attention.length === 0) {
    throw new TypeError('projection.attention must contain at least one item');
  }
  for (const [index, item] of value.attention.entries()) {
    const attention = object(item, `projection.attention[${index}]`);
    text(attention.id, `projection.attention[${index}].id`);
    text(attention.severity, `projection.attention[${index}].severity`);
    text(attention.reason, `projection.attention[${index}].reason`);
    text(attention.evidenceRef, `projection.attention[${index}].evidenceRef`);
    if (!Number.isFinite(attention.priority) || attention.advisoryOnly !== true) {
      throw new TypeError(`projection.attention[${index}] must be finite and advisory-only`);
    }
  }

  const suppliedFingerprint = text(
    value.projectionFingerprint,
    'projection.projectionFingerprint',
  );
  const expectedFingerprint = fingerprintOperatorAttentionProjection(value);
  if (suppliedFingerprint !== expectedFingerprint) {
    throw new TypeError('projection fingerprint integrity check failed');
  }

  return true;
}

export { OPERATOR_PROJECTION_VERSION, SUPPORTED_TARGETS };

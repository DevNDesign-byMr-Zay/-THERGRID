import { evaluateSolvaerDecisionHandoff } from './solvaer-decision-handoff.mjs';
import { createSolvaerCollaborationEvidence } from './solvaer-collaboration-evidence.mjs';
import {
  buildSolvaerOperatorAttention,
  validateSolvaerOperatorAttention,
} from './solvaer-operator-attention.mjs';
import {
  compileHolographicRenderPacket,
  validateHolographicRenderPacket,
} from './holographic-renderer-contract.mjs';

const BRIDGE_INPUT_KEYS = Object.freeze([
  'request',
  'candidate',
  'provenanceRef',
  'twinState',
  'forecast',
  'proposal',
  'scene',
  'presentation',
]);

function requirePlainDataObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be a plain object`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${path} must be a plain object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} must not contain symbol properties`);
  }
  return value;
}

function readOwnData(value, key, path) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!descriptor.enumerable) {
    throw new TypeError(`${path}.${key} must be enumerable data`);
  }
  if ('get' in descriptor || 'set' in descriptor) {
    throw new TypeError(`${path}.${key} must not use accessors`);
  }
  return descriptor.value;
}

function captureBridgeInput(input) {
  const value = requirePlainDataObject(input, 'render bridge input');
  const allowed = new Set(BRIDGE_INPUT_KEYS);
  const copy = {};

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new TypeError(`render bridge input contains unsupported field: ${key}`);
    }
    copy[key] = readOwnData(value, key, 'render bridge input');
  }
  return copy;
}

function hasUnsafeAuthority(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  requirePlainDataObject(value, path);
  return (
    readOwnData(value, 'authoritative', path) === true ||
    readOwnData(value, 'physicalActuation', path) === true ||
    readOwnData(value, 'actuatesHardware', path) === true ||
    readOwnData(value, 'advisoryOnly', path) === false
  );
}

function rejectAuthority(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return;
  if (hasUnsafeAuthority(candidate, 'candidate')) {
    throw new TypeError(
      'SOLVÆR candidate cannot cross render bridge with physical or authoritative execution authority',
    );
  }
  const safety = readOwnData(candidate, 'safety', 'candidate');
  if (safety != null && hasUnsafeAuthority(safety, 'candidate.safety')) {
    throw new TypeError(
      'SOLVÆR candidate cannot cross render bridge with physical or authoritative execution authority',
    );
  }
}

function readSceneProvenance(scene) {
  const sceneValue = requirePlainDataObject(scene, 'scene');
  return requirePlainDataObject(
    readOwnData(sceneValue, 'provenanceRef', 'scene'),
    'scene.provenanceRef',
  );
}

function bindSceneProvenance(scene, provenanceRef) {
  const sceneProvenanceRef = readSceneProvenance(scene);
  const provenanceValue = requirePlainDataObject(provenanceRef, 'provenanceRef');
  const sceneExperimentId = readOwnData(sceneProvenanceRef, 'experimentId', 'scene.provenanceRef');
  const sceneSnapshotId = readOwnData(sceneProvenanceRef, 'snapshotId', 'scene.provenanceRef');
  const refExperimentId = readOwnData(provenanceValue, 'experimentId', 'provenanceRef');
  const refSnapshotId = readOwnData(provenanceValue, 'snapshotId', 'provenanceRef');
  if (sceneExperimentId !== refExperimentId || sceneSnapshotId !== refSnapshotId) {
    throw new TypeError('render scene provenanceRef must match SOLVÆR provenanceRef');
  }
}

function bindSceneDecisionReceipt(scene, decisionReceiptId) {
  const sceneProvenanceRef = readSceneProvenance(scene);
  const sceneReceiptId = readOwnData(sceneProvenanceRef, 'receiptId', 'scene.provenanceRef');
  if (typeof sceneReceiptId !== 'string' || !sceneReceiptId.trim()) {
    throw new TypeError('render scene provenanceRef must contain a decision receiptId');
  }
  if (sceneReceiptId !== decisionReceiptId) {
    throw new TypeError('render scene receiptId must match SOLVÆR decision receiptId');
  }
}

/**
 * Join SOLVÆR decision evidence to THERGRID's renderer boundary without
 * granting the optimizer presentation or physical execution authority.
 */
export function buildSolvaerDecisionRenderBridge(input = {}) {
  const { request, candidate, provenanceRef, twinState, forecast, proposal, scene, presentation } =
    captureBridgeInput(input);

  rejectAuthority(candidate);
  bindSceneProvenance(scene, provenanceRef);
  const decision = evaluateSolvaerDecisionHandoff({
    request,
    candidate,
    provenanceRef,
    twinState,
    forecast,
    proposal,
  });
  bindSceneDecisionReceipt(scene, decision.decisionReceipt.receiptId);
  const collaborationEvidence = createSolvaerCollaborationEvidence({
    request,
    candidate: decision.candidate,
    provenanceRef,
  });
  const operatorAttention = buildSolvaerOperatorAttention({
    evidence: collaborationEvidence,
    decision,
    twinState,
  });
  if (!validateSolvaerOperatorAttention(operatorAttention)) {
    throw new TypeError('SOLVÆR render bridge produced invalid operator attention');
  }
  const renderPacket = compileHolographicRenderPacket({
    scene,
    presentation,
    experimentId: decision.experimentId,
    receiptId: decision.decisionReceipt.receiptId,
    operatorAttentionFingerprint: operatorAttention.attentionFingerprint,
  });
  if (!validateHolographicRenderPacket(renderPacket)) {
    throw new TypeError('SOLVÆR render bridge produced invalid packet');
  }

  return Object.freeze({
    requestId: decision.requestId,
    experimentId: decision.experimentId,
    decision,
    collaborationEvidence,
    operatorAttention,
    renderPacket,
    promotionEligible: false,
    handoff: 'simulation-evidence-required',
    safety: Object.freeze({
      authoritative: false,
      physicalActuation: false,
      actuatesHardware: false,
      advisoryOnly: true,
    }),
  });
}

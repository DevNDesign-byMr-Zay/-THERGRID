import { createHash } from 'node:crypto';
import { validateOperatorEvidencePackage } from './operator-evidence-package.mjs';

const OPERATOR_DASHBOARD_VIEW_VERSION = 2;
const VIEW_KEYS = Object.freeze([
  'version',
  'experimentId',
  'snapshotId',
  'requestId',
  'packageFingerprint',
  'attentionFingerprint',
  'sourceProvenanceFingerprint',
  'sourceViewFingerprint',
  'items',
  'interpretation',
  'safety',
  'dashboardFingerprint',
]);
const ITEM_KEYS = Object.freeze([
  'id',
  'priority',
  'severity',
  'reason',
  'evidenceRef',
  'assetNodeRefs',
]);
const ASSET_NODE_REF_KEYS = Object.freeze(['assetId', 'nodeId']);
const SAFETY_KEYS = Object.freeze([
  'advisoryOnly',
  'authoritative',
  'actuatesHardware',
  'promotionEligible',
  'dispatchesInfrastructure',
  'deploysInfrastructure',
]);

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

function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function readExactDataObject(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return null;
  }

  const copy = {};
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return null;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function readAssetNodeRefs(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const allowedKeys = new Set(['length']);
  const seen = new Set();
  const refs = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || 'get' in descriptor || 'set' in descriptor) return null;
    const ref = readExactDataObject(descriptor.value, ASSET_NODE_REF_KEYS);
    if (!ref) return null;
    if (
      typeof ref.assetId !== 'string' ||
      !ref.assetId.trim() ||
      typeof ref.nodeId !== 'string' ||
      !ref.nodeId.trim()
    ) {
      return null;
    }
    const normalized = { assetId: ref.assetId.trim(), nodeId: ref.nodeId.trim() };
    const identity = `${normalized.assetId}\u0000${normalized.nodeId}`;
    if (seen.has(identity)) return null;
    seen.add(identity);
    refs.push(normalized);
  }

  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
    return null;
  }
  return refs;
}

function readItems(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const allowedKeys = new Set(['length']);
  const items = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    allowedKeys.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || 'get' in descriptor || 'set' in descriptor) return null;
    const item = readExactDataObject(descriptor.value, ITEM_KEYS);
    if (!item) return null;
    const assetNodeRefs = readAssetNodeRefs(item.assetNodeRefs);
    if (!assetNodeRefs) return null;
    items.push({ ...item, assetNodeRefs });
  }
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowedKeys.has(key))) {
    return null;
  }
  return items;
}

function dashboardSafety() {
  return Object.freeze({
    advisoryOnly: true,
    authoritative: false,
    actuatesHardware: false,
    promotionEligible: false,
    dispatchesInfrastructure: false,
    deploysInfrastructure: false,
  });
}

function dashboardBody(evidencePackage) {
  if (!validateOperatorEvidencePackage(evidencePackage)) {
    throw new TypeError('validated operator evidence package is required');
  }

  const items = evidencePackage.readModel.items.map((item) =>
    Object.freeze({
      id: item.id,
      priority: item.priority,
      severity: item.severity,
      reason: item.reason,
      evidenceRef: item.evidenceRef,
      assetNodeRefs: Object.freeze(
        item.assetNodeRefs.map((ref) =>
          Object.freeze({
            assetId: ref.assetId,
            nodeId: ref.nodeId,
          }),
        ),
      ),
    }),
  );

  return deepFreeze({
    version: OPERATOR_DASHBOARD_VIEW_VERSION,
    experimentId: evidencePackage.experimentId,
    snapshotId: evidencePackage.snapshotId,
    requestId: evidencePackage.requestId,
    packageFingerprint: evidencePackage.packageFingerprint,
    attentionFingerprint: evidencePackage.manifest.attentionFingerprint,
    sourceProvenanceFingerprint: evidencePackage.manifest.provenanceFingerprint,
    sourceViewFingerprint: evidencePackage.manifest.viewFingerprint,
    items,
    interpretation: 'operator-dashboard-read-only',
    safety: dashboardSafety(),
  });
}

export function createOperatorDashboardView(evidencePackage) {
  const body = dashboardBody(evidencePackage);
  return deepFreeze({
    ...body,
    dashboardFingerprint: fingerprint(body),
  });
}

export function validateOperatorDashboardView(view, evidencePackage) {
  try {
    if (!validateOperatorEvidencePackage(evidencePackage)) return false;
    const values = readExactDataObject(view, VIEW_KEYS);
    if (!values) return false;
    if (values.version !== OPERATOR_DASHBOARD_VIEW_VERSION) return false;
    if (values.interpretation !== 'operator-dashboard-read-only') return false;
    for (const value of [
      values.packageFingerprint,
      values.attentionFingerprint,
      values.sourceProvenanceFingerprint,
      values.sourceViewFingerprint,
      values.dashboardFingerprint,
    ]) {
      if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return false;
    }

    const safety = readExactDataObject(values.safety, SAFETY_KEYS);
    const items = readItems(values.items);
    if (!safety || !items) return false;
    if (
      safety.advisoryOnly !== true ||
      safety.authoritative !== false ||
      safety.actuatesHardware !== false ||
      safety.promotionEligible !== false ||
      safety.dispatchesInfrastructure !== false ||
      safety.deploysInfrastructure !== false
    ) {
      return false;
    }

    const expected = dashboardBody(evidencePackage);
    const actualBody = { ...values, items, safety };
    delete actualBody.dashboardFingerprint;
    return (
      JSON.stringify(canonical(actualBody)) === JSON.stringify(canonical(expected)) &&
      values.dashboardFingerprint === fingerprint(expected)
    );
  } catch {
    return false;
  }
}

export { OPERATOR_DASHBOARD_VIEW_VERSION };

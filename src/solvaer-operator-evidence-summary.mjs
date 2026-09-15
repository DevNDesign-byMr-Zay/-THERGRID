import { createHash } from 'node:crypto';

const SUMMARY_BODY_KEYS = Object.freeze([
  'snapshotId',
  'experimentId',
  'simulationStatus',
  'receiptId',
  'sceneId',
  'renderTarget',
  'provenanceValid',
  'promotionStatus',
  'authoritative',
  'solvaerRequestId',
  'collaborationEvidenceFingerprint',
  'simulationEvidenceFingerprint',
  'operatorProjectionFingerprint',
  'operatorProjectionValid',
  'operatorInterpretation',
  'operatorResidualBalanceKw',
  'operatorGridAdjustmentKw',
  'operatorPromotionEligible',
  'operatorAdvisoryOnly',
  'operatorAuthoritative',
  'operatorActuatesHardware',
]);
const SUMMARY_KEYS = Object.freeze([...SUMMARY_BODY_KEYS, 'summaryFingerprint']);
const HEX_64 = /^[a-f0-9]{64}$/;

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

function readExactDataObject(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  if (Object.getOwnPropertySymbols(value).length > 0) return null;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== expectedKeys.length) return null;
  if (keys.some((key) => !expectedKeys.includes(key))) return null;

  const copy = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || 'get' in descriptor || 'set' in descriptor) {
      return null;
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeBody(body) {
  const values = readExactDataObject(body, SUMMARY_BODY_KEYS);
  if (!values) throw new TypeError('operator evidence summary body must use the exact allowlisted fields');

  for (const key of [
    'snapshotId',
    'experimentId',
    'simulationStatus',
    'receiptId',
    'sceneId',
    'renderTarget',
    'promotionStatus',
    'solvaerRequestId',
  ]) {
    if (!isNonEmptyString(values[key])) throw new TypeError(`${key} must be a non-empty string`);
    values[key] = values[key].trim();
  }

  if (values.provenanceValid !== true) throw new TypeError('provenanceValid must remain true');
  if (values.authoritative !== false) throw new TypeError('authoritative must remain false');
  if (values.operatorProjectionValid !== true) throw new TypeError('operatorProjectionValid must remain true');
  if (values.operatorInterpretation !== 'operator-review-only') {
    throw new TypeError('operatorInterpretation must remain operator-review-only');
  }
  if (values.operatorPromotionEligible !== false) {
    throw new TypeError('operatorPromotionEligible must remain false');
  }
  if (values.operatorAdvisoryOnly !== true) throw new TypeError('operatorAdvisoryOnly must remain true');
  if (values.operatorAuthoritative !== false) throw new TypeError('operatorAuthoritative must remain false');
  if (values.operatorActuatesHardware !== false) {
    throw new TypeError('operatorActuatesHardware must remain false');
  }
  if (!Number.isFinite(values.operatorResidualBalanceKw)) {
    throw new TypeError('operatorResidualBalanceKw must be finite');
  }
  if (!Number.isFinite(values.operatorGridAdjustmentKw)) {
    throw new TypeError('operatorGridAdjustmentKw must be finite');
  }
  for (const key of [
    'collaborationEvidenceFingerprint',
    'simulationEvidenceFingerprint',
    'operatorProjectionFingerprint',
  ]) {
    if (!HEX_64.test(values[key])) throw new TypeError(`${key} must be a SHA-256 fingerprint`);
  }

  return Object.freeze(values);
}

export function createSolvaerOperatorEvidenceSummary(body = {}) {
  const normalized = normalizeBody(body);
  return Object.freeze({
    ...normalized,
    summaryFingerprint: fingerprint(normalized),
  });
}

export function validateSolvaerOperatorEvidenceSummary(summary) {
  try {
    const values = readExactDataObject(summary, SUMMARY_KEYS);
    if (!values || !HEX_64.test(values.summaryFingerprint)) return false;
    const body = Object.fromEntries(SUMMARY_BODY_KEYS.map((key) => [key, values[key]]));
    const normalized = normalizeBody(body);
    return values.summaryFingerprint === fingerprint(normalized);
  } catch {
    return false;
  }
}

export { SUMMARY_BODY_KEYS as SOLVAER_OPERATOR_EVIDENCE_SUMMARY_KEYS };

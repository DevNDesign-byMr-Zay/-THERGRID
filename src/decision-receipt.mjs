import { createHash } from 'node:crypto';

const RECEIPT_VERSION = 1;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requireFiniteNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

/**
 * @param {{
 *   twinState?: any,
 *   forecast?: any,
 *   proposal?: any
 * }} [options]
 */
export function buildDecisionReceipt({ twinState, forecast, proposal } = {}) {
  const twin = requireObject(twinState, 'twinState');
  const predicted = requireObject(forecast, 'forecast');
  const decision = requireObject(proposal, 'proposal');

  const snapshotId = requireNonEmptyString(twin.snapshotId, 'twinState.snapshotId');
  if (predicted.snapshotId !== snapshotId || decision.snapshotId !== snapshotId) {
    throw new TypeError('forecast and proposal snapshotId must match twinState.snapshotId');
  }
  if (decision.advisoryOnly !== true) {
    throw new TypeError('proposal must remain advisory-only');
  }
  if (decision.forecastFor !== predicted.forecastFor) {
    throw new TypeError('proposal.forecastFor must match forecast.forecastFor');
  }

  const action = requireObject(decision.action, 'proposal.action');

  return {
    contractVersion: RECEIPT_VERSION,
    snapshotId,
    observedAt: requireNonEmptyString(twin.observedAt, 'twinState.observedAt'),
    forecastFor: requireNonEmptyString(predicted.forecastFor, 'forecast.forecastFor'),
    forecast: {
      method: requireNonEmptyString(predicted.method, 'forecast.method'),
      horizonMinutes: predicted.horizonMinutes,
      generationKw: requireFiniteNumber(predicted.generationKw, 'forecast.generationKw'),
      loadKw: requireFiniteNumber(predicted.loadKw, 'forecast.loadKw'),
    },
    proposal: {
      strategy: requireNonEmptyString(decision.strategy, 'proposal.strategy'),
      projectedBalanceKw: requireFiniteNumber(
        decision.projectedBalanceKw,
        'proposal.projectedBalanceKw',
      ),
      action: {
        kind: requireNonEmptyString(action.kind, 'proposal.action.kind'),
        adjustmentKw: requireFiniteNumber(action.adjustmentKw, 'proposal.action.adjustmentKw'),
        targetKw: requireFiniteNumber(action.targetKw, 'proposal.action.targetKw'),
      },
      advisoryOnly: true,
    },
  };
}

export function serializeDecisionReceipt(receipt) {
  const value = requireObject(receipt, 'receipt');
  if (value.contractVersion !== RECEIPT_VERSION) {
    throw new TypeError(`receipt.contractVersion must equal ${RECEIPT_VERSION}`);
  }
  return JSON.stringify(value);
}

export function fingerprintDecisionReceipt(receipt) {
  return createHash('sha256').update(serializeDecisionReceipt(receipt), 'utf8').digest('hex');
}

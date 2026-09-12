import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildDecisionReceipt,
  fingerprintDecisionReceipt,
  serializeDecisionReceipt,
} from '../src/decision-receipt.mjs';
import { buildBaselineOperatingProposal, buildPersistenceForecast } from '../src/planning.mjs';
import { deriveTwinState } from '../src/twin.mjs';

async function decisionInputs() {
  const source = await readFile(new URL('../fixtures/microgrid.json', import.meta.url), 'utf8');
  const twinState = deriveTwinState(JSON.parse(source));
  const forecast = buildPersistenceForecast(twinState);
  const proposal = buildBaselineOperatingProposal(twinState, forecast);
  return { twinState, forecast, proposal };
}

test('decision receipt is deterministic and produces a stable SHA-256 fingerprint', async () => {
  const input = await decisionInputs();

  const first = buildDecisionReceipt(input);
  const second = buildDecisionReceipt(input);

  assert.deepEqual(first, second);
  assert.equal(serializeDecisionReceipt(first), serializeDecisionReceipt(second));
  assert.equal(first.proposal.advisoryOnly, true);

  const fingerprint = fingerprintDecisionReceipt(first);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint, fingerprintDecisionReceipt(second));
});

test('decision receipt rejects forecast evidence from another snapshot', async () => {
  const input = await decisionInputs();

  assert.throws(
    () => buildDecisionReceipt({
      ...input,
      forecast: { ...input.forecast, snapshotId: 'other-snapshot' },
    }),
    /snapshotId must match/,
  );
});

test('decision receipt rejects proposals that are not advisory-only', async () => {
  const input = await decisionInputs();

  assert.throws(
    () => buildDecisionReceipt({
      ...input,
      proposal: { ...input.proposal, advisoryOnly: false },
    }),
    /advisory-only/,
  );
});

test('decision receipt rejects proposal timestamps that drift from the forecast', async () => {
  const input = await decisionInputs();

  assert.throws(
    () => buildDecisionReceipt({
      ...input,
      proposal: { ...input.proposal, forecastFor: '2026-09-12T16:30:00.000Z' },
    }),
    /proposal\.forecastFor must match forecast\.forecastFor/,
  );
});

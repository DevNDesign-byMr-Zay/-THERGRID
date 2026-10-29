import assert from 'node:assert/strict';
import test from 'node:test';

import { computeOperatorOptimization } from '../apps/aethergrid-console/analysis/operator-optimization.mjs';

const scenarioParameters = Object.freeze({
  loadMultiplierPercent: 110,
  renewableAvailabilityPercent: 100,
  storageReservePercent: 18,
  weatherRiskPercent: 20,
});

const baseline = { scenario: 'peak-demand', scenarioParameters };

test('default optimization preserves independent classical and modeled candidate metrics', () => {
  const result = computeOperatorOptimization({}, baseline);
  assert.deepEqual(
    {
      currentCost: result.currentCost,
      classicalCandidateCost: result.classicalCandidateCost,
      candidateCost: result.candidateCost,
      emissionsReduction: result.emissionsReduction,
      renewableUtilizationGain: result.renewableUtilizationGain,
      reliabilityScore: result.reliabilityScore,
    },
    {
      currentCost: 12480,
      classicalCandidateCost: 11606,
      candidateCost: 11244,
      emissionsReduction: 19,
      renewableUtilizationGain: 13,
      reliabilityScore: 90.5,
    },
  );
  assert.equal(result.objective, 'balanced');
  assert.equal(result.classicalBaselineRequired, true);
  assert.ok(result.classicalCandidateCost > result.candidateCost);
});

test('scenario and objective choices affect only the advisory model outputs', () => {
  const defaultResult = computeOperatorOptimization({}, baseline);
  const weatherResult = computeOperatorOptimization(
    { objective: 'reliability' },
    { ...baseline, scenario: 'weather-event' },
  );
  const renewableResult = computeOperatorOptimization(
    { objective: 'renewables' },
    { ...baseline, scenario: 'renewable-surge' },
  );
  assert.ok(weatherResult.currentCost > defaultResult.currentCost);
  assert.ok(renewableResult.currentCost < defaultResult.currentCost);
  assert.ok(renewableResult.renewableUtilizationGain > defaultResult.renewableUtilizationGain);
  assert.ok(weatherResult.reliabilityScore < defaultResult.reliabilityScore);
  assert.ok([weatherResult, renewableResult].every((result) => result.candidateCost > 0));
});

test('untrusted objective weights are bounded and non-numeric weights use defaults', () => {
  const input = {
    objective: 'other',
    weights: { cost: 900, emissions: -30 },
    constraints: { minimumReservePercent: 40, classicalBaselineRequired: false },
  };
  const original = structuredClone(input);
  const result = computeOperatorOptimization(input, baseline);
  assert.deepEqual(input, original);
  assert.equal(result.objective, 'other');
  assert.equal(result.costWeight, 100);
  assert.equal(result.emissionsWeight, 0);
  assert.equal(result.minimumReservePercent, 40);
  assert.equal(result.classicalBaselineRequired, false);
  const fallback = computeOperatorOptimization(
    { weights: { cost: 'no-number', emissions: null } },
    baseline,
  );
  assert.equal(fallback.costWeight, 50);
  assert.equal(fallback.emissionsWeight, 0);
});

test('custom scenarios are deterministic without modifying the operator scenario state', () => {
  const custom = Object.freeze({
    loadMultiplierPercent: 125,
    renewableAvailabilityPercent: 120,
    storageReservePercent: 25,
    weatherRiskPercent: 80,
  });
  const context = { scenario: 'custom', scenarioParameters: custom };
  const input = { objective: 'cost', weights: { cost: 80, emissions: 20 } };
  const first = computeOperatorOptimization(input, context);
  const second = computeOperatorOptimization(input, context);
  assert.deepEqual(first, second);
  assert.equal(custom.loadMultiplierPercent, 125);
  assert.ok(first.currentCost > 12480);
  assert.ok(first.candidateCost > 0);
  assert.ok(first.reliabilityScore >= 0 && first.reliabilityScore <= 100);
  assert.equal(Object.hasOwn(first, 'physicalActuation'), false);
  assert.equal(Object.hasOwn(first, 'infrastructureDispatch'), false);
});

// Deterministic advisory modeling only; these numbers are not measured
// infrastructure observations, dispatch commands or quantum hardware results.
export function computeOperatorOptimization(input = {}, { scenario, scenarioParameters }) {
  const objective = String(input.objective || 'balanced');
  const rawCostWeight = Number(input.weights?.cost ?? 50);
  const rawEmissionsWeight = Number(input.weights?.emissions ?? 50);
  const costWeight = Math.max(0, Math.min(100, Number.isFinite(rawCostWeight) ? rawCostWeight : 50));
  const emissionsWeight = Math.max(
    0,
    Math.min(100, Number.isFinite(rawEmissionsWeight) ? rawEmissionsWeight : 50),
  );
  const minimumReservePercent = Math.max(
    5,
    Math.min(40, Number(input.constraints?.minimumReservePercent ?? 18)),
  );
  const classicalBaselineRequired =
    input.constraints?.classicalBaselineRequired !== false;

  const custom = scenarioParameters;
  const customFactor =
    (custom.loadMultiplierPercent / 100) *
    (1 + custom.weatherRiskPercent / 1000) *
    (1 + Math.max(0, custom.storageReservePercent - 18) / 500) *
    (1 - Math.max(0, custom.renewableAvailabilityPercent - 100) / 1000);
  const scenarioFactor = {
    'peak-demand': 1.0,
    'renewable-surge': 0.88,
    'storage-stress': 1.12,
    'weather-event': 1.18,
    custom: customFactor,
  }[scenario] ?? 1.0;

  const objectiveBias = {
    balanced: { cost: 0.5, emissions: 0.5, reliability: 0.5, renewable: 0.5 },
    cost: { cost: 0.9, emissions: 0.2, reliability: 0.45, renewable: 0.35 },
    emissions: { cost: 0.25, emissions: 0.95, reliability: 0.45, renewable: 0.7 },
    reliability: { cost: 0.25, emissions: 0.3, reliability: 0.95, renewable: 0.4 },
    renewables: { cost: 0.3, emissions: 0.75, reliability: 0.5, renewable: 0.95 },
  }[objective] ?? { cost: 0.5, emissions: 0.5, reliability: 0.5, renewable: 0.5 };

  const normalizedCost = costWeight / 100;
  const normalizedEmissions = emissionsWeight / 100;
  const reservePenalty = Math.max(0, minimumReservePercent - 18) * 0.0028;
  const currentCost = 12480 * scenarioFactor;
  const classicalImprovement =
    0.045 +
    normalizedCost * 0.028 +
    objectiveBias.cost * 0.022 -
    reservePenalty * 0.35;
  const experimentalImprovement =
    classicalImprovement +
    0.018 +
    objectiveBias.renewable * 0.014 +
    normalizedEmissions * 0.008 -
    reservePenalty * 0.2;

  const classicalCandidateCost = Math.round(
    currentCost * (1 - Math.max(0.02, Math.min(0.14, classicalImprovement))),
  );
  const candidateCost = Math.round(
    currentCost * (1 - Math.max(0.03, Math.min(0.19, experimentalImprovement))),
  );
  const emissionsReduction = Number(
    (
      10 +
      normalizedEmissions * 11 +
      objectiveBias.emissions * 7 +
      (scenario === 'renewable-surge' ? 4 : 0) +
      (scenario === 'custom'
        ? Math.max(0, scenarioParameters.renewableAvailabilityPercent - 100) * 0.08
        : 0)
    ).toFixed(1),
  );
  const renewableUtilizationGain = Number(
    (
      6 +
      objectiveBias.renewable * 10 +
      normalizedEmissions * 4 +
      (scenario === 'renewable-surge' ? 5 : 0) +
      (scenario === 'custom'
        ? Math.max(0, scenarioParameters.renewableAvailabilityPercent - 100) * 0.12
        : 0)
    ).toFixed(1),
  );
  const reliabilityScore = Number(
    Math.max(
      0,
      Math.min(
        100,
        82 +
          objectiveBias.reliability * 9 +
          minimumReservePercent * 0.22 -
          (scenario === 'weather-event' ? 7 : 0),
      ),
    ).toFixed(1),
  );

  return {
    objective,
    costWeight,
    emissionsWeight,
    minimumReservePercent,
    classicalBaselineRequired,
    currentCost,
    classicalCandidateCost,
    candidateCost,
    emissionsReduction,
    renewableUtilizationGain,
    reliabilityScore,
  };
}

import type { OperatorScenario, OperatorScenarioComparison } from '../services/operator-scenario';

interface ScenarioComparisonSummaryProps {
  scenario: OperatorScenario;
  comparison: OperatorScenarioComparison;
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`;
}

export function ScenarioComparisonSummary({
  scenario,
  comparison,
}: ScenarioComparisonSummaryProps) {
  return (
    <>
      <div className="scenario-baseline-grid">
        <span>
          <small>BASE REGION</small>
          <strong>{scenario.baseline.region}</strong>
        </span>
        <span>
          <small>BASE FRAME</small>
          <strong>{scenario.baseline.temporal.mode.toUpperCase()}</strong>
        </span>
        <span>
          <small>ENTITIES</small>
          <strong>{scenario.references.canonicalEntityIds.length}</strong>
        </span>
        <span>
          <small>INCIDENT REFS</small>
          <strong>{scenario.references.incidentIds.length}</strong>
        </span>
      </div>

      <div className="scenario-comparison-grid">
        <span>
          <small>LOAD Δ</small>
          <strong>{signed(comparison.deltas.loadMultiplierPercent)} pts</strong>
        </span>
        <span>
          <small>RENEWABLE Δ</small>
          <strong>{signed(comparison.deltas.renewableAvailabilityPercent)} pts</strong>
        </span>
        <span>
          <small>STORAGE Δ</small>
          <strong>{signed(comparison.deltas.storageReservePercent)} pts</strong>
        </span>
        <span>
          <small>WEATHER Δ</small>
          <strong>{signed(comparison.deltas.weatherRiskPercent)} pts</strong>
        </span>
      </div>

      <div className="scenario-visual-grid">
        <span>
          <small>VISUAL STRESS</small>
          <strong>{comparison.visual.stressFactor.toFixed(2)}×</strong>
        </span>
        <span>
          <small>RENEWABLE BIAS</small>
          <strong>{comparison.visual.renewableBias.toFixed(2)}</strong>
        </span>
        <span>
          <small>STORAGE STRESS</small>
          <strong>{comparison.visual.storageStress.toFixed(2)}</strong>
        </span>
        <span>
          <small>WEATHER RISK</small>
          <strong>{comparison.visual.weatherRisk.toFixed(2)}</strong>
        </span>
      </div>
    </>
  );
}

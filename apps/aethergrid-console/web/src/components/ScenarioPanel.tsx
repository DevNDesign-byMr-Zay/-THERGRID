import { useState } from 'react';

import {
  applyScenario,
  returnToLiveView,
  scenarioVisualState,
  type ScenarioId,
  type ScenarioParameters,
  type ScenarioVisualState
} from '../services/scenario-client';

const TEMPLATES: readonly { id: ScenarioId; label: string }[] = [
  { id: 'peak-demand', label: 'PEAK DEMAND' },
  { id: 'renewable-surge', label: 'RENEWABLE SURGE' },
  { id: 'storage-stress', label: 'STORAGE STRESS' },
  { id: 'weather-event', label: 'WEATHER EVENT' },
  { id: 'custom', label: 'CUSTOM' }
];

const DEFAULT_CUSTOM: ScenarioParameters = {
  loadMultiplierPercent: 110,
  renewableAvailabilityPercent: 100,
  storageReservePercent: 18,
  weatherRiskPercent: 20
};

interface ScenarioPanelProps {
  activeTemporalMode: string;
  onScenarioApplied(scenario: ScenarioId, visual: ScenarioVisualState): void;
  onReturnLive(): void;
}

export function ScenarioPanel({
  activeTemporalMode,
  onScenarioApplied,
  onReturnLive
}: ScenarioPanelProps) {
  const [scenario, setScenario] = useState<ScenarioId>('peak-demand');
  const [parameters, setParameters] = useState<ScenarioParameters>(DEFAULT_CUSTOM);
  const [running, setRunning] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [activeVisual, setActiveVisual] = useState<ScenarioVisualState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const result = await applyScenario(
        scenario,
        scenario === 'custom' ? parameters : undefined
      );
      setReceipt(result.evidence?.receipt || result.evidence?.id || null);
      const serverParameters =
        result.state?.system?.scenarioParameters ?? parameters;
      const visual = scenarioVisualState(scenario, serverParameters);
      setActiveVisual(visual);
      onScenarioApplied(scenario, visual);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
    } finally {
      setRunning(false);
    }
  };

  const goLive = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      await returnToLiveView();
      setReceipt(null);
      setActiveVisual(null);
      onReturnLive();
    } catch (liveError) {
      setError(liveError instanceof Error ? liveError.message : String(liveError));
    } finally {
      setRunning(false);
    }
  };

  const setParameter = (key: keyof ScenarioParameters, value: number) => {
    setParameters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="scenario-panel">
      <div className="scenario-head">
        <span>
          <small>4D SCENARIOS</small>
          <strong>{activeTemporalMode.toUpperCase()}</strong>
        </span>
        <em>ADVISORY</em>
      </div>

      <div className="scenario-templates">
        {TEMPLATES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={scenario === item.id ? 'active' : ''}
            onClick={() => setScenario(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {scenario === 'custom' ? (
        <div className="scenario-parameters">
          <label>
            <span>LOAD <strong>{parameters.loadMultiplierPercent}%</strong></span>
            <input
              type="range"
              min="70"
              max="150"
              value={parameters.loadMultiplierPercent}
              onChange={(event) =>
                setParameter('loadMultiplierPercent', Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span>RENEWABLE <strong>{parameters.renewableAvailabilityPercent}%</strong></span>
            <input
              type="range"
              min="40"
              max="160"
              value={parameters.renewableAvailabilityPercent}
              onChange={(event) =>
                setParameter('renewableAvailabilityPercent', Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span>STORAGE RESERVE <strong>{parameters.storageReservePercent}%</strong></span>
            <input
              type="range"
              min="5"
              max="45"
              value={parameters.storageReservePercent}
              onChange={(event) =>
                setParameter('storageReservePercent', Number(event.currentTarget.value))
              }
            />
          </label>
          <label>
            <span>WEATHER RISK <strong>{parameters.weatherRiskPercent}%</strong></span>
            <input
              type="range"
              min="0"
              max="100"
              value={parameters.weatherRiskPercent}
              onChange={(event) =>
                setParameter('weatherRiskPercent', Number(event.currentTarget.value))
              }
            />
          </label>
        </div>
      ) : null}

      <div className="scenario-actions">
        <button type="button" className="apply" onClick={() => void apply()} disabled={running}>
          {running ? 'APPLYING…' : 'APPLY SCENARIO'}
        </button>
        <button type="button" onClick={() => void goLive()} disabled={running}>
          RETURN LIVE
        </button>
      </div>

      {activeVisual ? (
        <div className="scenario-visual-metrics">
          <span>
            <small>STRESS</small>
            <strong>{activeVisual.stressFactor.toFixed(2)}×</strong>
          </span>
          <span>
            <small>RENEWABLE</small>
            <strong>{activeVisual.renewableBias.toFixed(2)}</strong>
          </span>
          <span>
            <small>STORAGE</small>
            <strong>{activeVisual.storageStress.toFixed(2)}</strong>
          </span>
          <span>
            <small>WEATHER</small>
            <strong>{activeVisual.weatherRisk.toFixed(2)}</strong>
          </span>
        </div>
      ) : null}

      {receipt ? (
        <div className="scenario-receipt">
          <span>EVIDENCE RECEIPT</span>
          <code>{receipt.slice(0, 16)}</code>
        </div>
      ) : null}

      {error ? <div className="agent-error">{error}</div> : null}
    </section>
  );
}

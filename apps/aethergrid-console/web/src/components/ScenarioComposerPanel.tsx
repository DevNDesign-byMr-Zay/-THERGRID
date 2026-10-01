import { useMemo, useState } from 'react';

import type { ScenarioId, ScenarioParameters } from '../services/scenario-client';
import {
  addOperatorScenarioAssumption,
  branchOperatorScenario,
  compareOperatorScenario,
  createOperatorScenario,
  downloadOperatorScenario,
  loadOperatorScenarios,
  MAX_OPERATOR_SCENARIOS,
  removeOperatorScenario,
  removeOperatorScenarioAssumption,
  saveOperatorScenarios,
  setOperatorScenarioStatus,
  updateOperatorScenarioParameters,
  upsertOperatorScenario,
  type OperatorScenario,
  type OperatorScenarioContext
} from '../services/operator-scenario';

const TEMPLATES: readonly { id: ScenarioId; label: string }[] = [
  { id: 'peak-demand', label: 'PEAK DEMAND' },
  { id: 'renewable-surge', label: 'RENEWABLE SURGE' },
  { id: 'storage-stress', label: 'STORAGE STRESS' },
  { id: 'weather-event', label: 'WEATHER EVENT' },
  { id: 'custom', label: 'CUSTOM' }
];

const DEFAULT_PARAMETERS: ScenarioParameters = {
  loadMultiplierPercent: 110,
  renewableAvailabilityPercent: 100,
  storageReservePercent: 18,
  weatherRiskPercent: 20
};

interface ScenarioComposerPanelProps {
  context: OperatorScenarioContext;
  activeScenarioId: string | null;
  onActivate(scenario: OperatorScenario): void;
  onDeactivate(): void;
  onAnalyze(scenario: OperatorScenario): void;
}

function inputDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function inputToIso(value: string, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`;
}

export function ScenarioComposerPanel({
  context,
  activeScenarioId,
  onActivate,
  onDeactivate,
  onAnalyze
}: ScenarioComposerPanelProps) {
  const [scenarios, setScenarios] =
    useState<OperatorScenario[]>(loadOperatorScenarios);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadOperatorScenarios()[0]?.id ?? null
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<ScenarioId>('custom');
  const [parameters, setParameters] =
    useState<ScenarioParameters>(DEFAULT_PARAMETERS);
  const [startValue, setStartValue] = useState(() =>
    inputDateTime(context.temporal.iso)
  );
  const [endValue, setEndValue] = useState('');
  const [assumption, setAssumption] = useState('');

  const selected = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedId) ?? null,
    [scenarios, selectedId]
  );

  const comparison = useMemo(
    () => (selected ? compareOperatorScenario(selected) : null),
    [selected]
  );

  const persist = (scenario: OperatorScenario) => {
    const next = upsertOperatorScenario(scenarios, scenario);
    setScenarios(next);
    setSelectedId(scenario.id);
    if (scenario.id === activeScenarioId) onActivate(scenario);
  };

  const create = () => {
    const scenario = createOperatorScenario(
      name,
      description,
      template,
      parameters,
      inputToIso(startValue, context.temporal.iso),
      endValue ? inputToIso(endValue, context.temporal.iso) : null,
      context
    );
    persist(scenario);
    setName('');
    setDescription('');
    setTemplate('custom');
    setParameters(DEFAULT_PARAMETERS);
    setStartValue(inputDateTime(context.temporal.iso));
    setEndValue('');
  };

  const activate = (scenario: OperatorScenario) => {
    const next = scenarios.map((candidate) =>
      setOperatorScenarioStatus(
        candidate,
        candidate.id === scenario.id ? 'active' : candidate.status === 'active'
          ? 'draft'
          : candidate.status
      )
    );
    const active = next.find((candidate) => candidate.id === scenario.id);
    const saved = saveOperatorScenarios(next);
    setScenarios(saved);
    if (active) {
      setSelectedId(active.id);
      onActivate(active);
    }
  };

  const deactivate = () => {
    const next = scenarios.map((candidate) =>
      candidate.id === activeScenarioId
        ? setOperatorScenarioStatus(candidate, 'draft')
        : candidate
    );
    setScenarios(saveOperatorScenarios(next));
    onDeactivate();
  };

  const remove = (id: string) => {
    const next = removeOperatorScenario(scenarios, id);
    setScenarios(next);
    if (activeScenarioId === id) onDeactivate();
    setSelectedId(next[0]?.id ?? null);
  };

  const branchSelected = () => {
    if (!selected) return;
    const branched = branchOperatorScenario(selected);
    persist(branched);
  };

  const changeSelectedParameter = (
    key: keyof ScenarioParameters,
    value: number
  ) => {
    if (!selected) return;
    persist(
      updateOperatorScenarioParameters(selected, {
        ...selected.parameters,
        [key]: value
      })
    );
  };

  const addAssumption = () => {
    if (!selected || !assumption.trim()) return;
    persist(addOperatorScenarioAssumption(selected, assumption));
    setAssumption('');
  };

  return (
    <section className="scenario-composer-panel">
      <div className="scenario-composer-head">
        <span>
          <small>4D SCENARIO COMPOSER</small>
          <strong>
            {scenarios.length}/{MAX_OPERATOR_SCENARIOS} SAVED
          </strong>
        </span>
        <em>MODELED</em>
      </div>

      <div className="scenario-composer-create">
        <input
          value={name}
          maxLength={120}
          placeholder="Scenario name"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <textarea
          value={description}
          maxLength={1500}
          placeholder="What hypothetical condition are you exploring?"
          onChange={(event) => setDescription(event.currentTarget.value)}
        />

        <div className="scenario-template-row">
          {TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={template === item.id ? 'active' : ''}
              onClick={() => setTemplate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="scenario-time-grid">
          <label>
            <small>START</small>
            <input
              type="datetime-local"
              value={startValue}
              onChange={(event) => setStartValue(event.currentTarget.value)}
            />
          </label>
          <label>
            <small>END · OPTIONAL</small>
            <input
              type="datetime-local"
              value={endValue}
              onChange={(event) => setEndValue(event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="scenario-composer-parameters">
          <label>
            <span>
              LOAD <strong>{parameters.loadMultiplierPercent}%</strong>
            </span>
            <input
              type="range"
              min="50"
              max="200"
              value={parameters.loadMultiplierPercent}
              onChange={(event) =>
                setParameters((current) => ({
                  ...current,
                  loadMultiplierPercent: Number(event.currentTarget.value)
                }))
              }
            />
          </label>
          <label>
            <span>
              RENEWABLE{' '}
              <strong>{parameters.renewableAvailabilityPercent}%</strong>
            </span>
            <input
              type="range"
              min="0"
              max="200"
              value={parameters.renewableAvailabilityPercent}
              onChange={(event) =>
                setParameters((current) => ({
                  ...current,
                  renewableAvailabilityPercent: Number(
                    event.currentTarget.value
                  )
                }))
              }
            />
          </label>
          <label>
            <span>
              STORAGE RESERVE{' '}
              <strong>{parameters.storageReservePercent}%</strong>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={parameters.storageReservePercent}
              onChange={(event) =>
                setParameters((current) => ({
                  ...current,
                  storageReservePercent: Number(event.currentTarget.value)
                }))
              }
            />
          </label>
          <label>
            <span>
              WEATHER RISK <strong>{parameters.weatherRiskPercent}%</strong>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={parameters.weatherRiskPercent}
              onChange={(event) =>
                setParameters((current) => ({
                  ...current,
                  weatherRiskPercent: Number(event.currentTarget.value)
                }))
              }
            />
          </label>
        </div>

        <div className="scenario-context-capture">
          <span>
            {context.workset.length} pinned entities
          </span>
          <span>{context.incidents.length} local incidents</span>
          <span>
            {Number(Boolean(context.observationA)) +
              Number(Boolean(context.observationB))}{' '}
            A/B captures
          </span>
          <span>{context.geometry.edgeCount} analytical links</span>
        </div>

        <button type="button" className="scenario-create" onClick={create}>
          SAVE HYPOTHETICAL SCENARIO
        </button>
      </div>

      {scenarios.length ? (
        <div className="scenario-composer-list">
          {scenarios.map((scenario) => (
            <button
              type="button"
              key={scenario.id}
              className={selectedId === scenario.id ? 'active' : ''}
              onClick={() => setSelectedId(scenario.id)}
            >
              <span>
                <small>
                  {scenario.status.toUpperCase()} · v{scenario.version} ·{' '}
                  {scenario.template.toUpperCase()}
                </small>
                <strong>{scenario.name}</strong>
              </span>
              <em>
                {scenario.id === activeScenarioId ? 'ACTIVE MODEL' : 'SAVED'}
              </em>
            </button>
          ))}
        </div>
      ) : null}

      {selected && comparison ? (
        <article className="scenario-composer-detail">
          <header>
            <span>
              <small>SELECTED HYPOTHESIS · VERSION {selected.version}</small>
              <strong>{selected.name}</strong>
            </span>
            <em>{selected.status.toUpperCase()}</em>
          </header>

          {selected.description ? <p>{selected.description}</p> : null}

          <div className="scenario-baseline-grid">
            <span>
              <small>BASE REGION</small>
              <strong>{selected.baseline.region}</strong>
            </span>
            <span>
              <small>BASE FRAME</small>
              <strong>{selected.baseline.temporal.mode.toUpperCase()}</strong>
            </span>
            <span>
              <small>ENTITIES</small>
              <strong>{selected.references.canonicalEntityIds.length}</strong>
            </span>
            <span>
              <small>INCIDENT REFS</small>
              <strong>{selected.references.incidentIds.length}</strong>
            </span>
          </div>

          <div className="scenario-comparison-grid">
            <span>
              <small>LOAD Δ</small>
              <strong>
                {signed(comparison.deltas.loadMultiplierPercent)} pts
              </strong>
            </span>
            <span>
              <small>RENEWABLE Δ</small>
              <strong>
                {signed(comparison.deltas.renewableAvailabilityPercent)} pts
              </strong>
            </span>
            <span>
              <small>STORAGE Δ</small>
              <strong>
                {signed(comparison.deltas.storageReservePercent)} pts
              </strong>
            </span>
            <span>
              <small>WEATHER Δ</small>
              <strong>
                {signed(comparison.deltas.weatherRiskPercent)} pts
              </strong>
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

          <div className="scenario-selected-parameters">
            <label>
              <span>LOAD</span>
              <input
                type="range"
                min="50"
                max="200"
                value={selected.parameters.loadMultiplierPercent}
                onChange={(event) =>
                  changeSelectedParameter(
                    'loadMultiplierPercent',
                    Number(event.currentTarget.value)
                  )
                }
              />
            </label>
            <label>
              <span>RENEWABLE</span>
              <input
                type="range"
                min="0"
                max="200"
                value={selected.parameters.renewableAvailabilityPercent}
                onChange={(event) =>
                  changeSelectedParameter(
                    'renewableAvailabilityPercent',
                    Number(event.currentTarget.value)
                  )
                }
              />
            </label>
            <label>
              <span>STORAGE</span>
              <input
                type="range"
                min="0"
                max="100"
                value={selected.parameters.storageReservePercent}
                onChange={(event) =>
                  changeSelectedParameter(
                    'storageReservePercent',
                    Number(event.currentTarget.value)
                  )
                }
              />
            </label>
            <label>
              <span>WEATHER</span>
              <input
                type="range"
                min="0"
                max="100"
                value={selected.parameters.weatherRiskPercent}
                onChange={(event) =>
                  changeSelectedParameter(
                    'weatherRiskPercent',
                    Number(event.currentTarget.value)
                  )
                }
              />
            </label>
          </div>

          <div className="scenario-assumption-compose">
            <input
              value={assumption}
              maxLength={1000}
              placeholder="Add explicit modeling assumption"
              onChange={(event) => setAssumption(event.currentTarget.value)}
            />
            <button type="button" onClick={addAssumption}>
              ADD ASSUMPTION
            </button>
          </div>

          {selected.assumptions.length ? (
            <div className="scenario-assumption-list">
              {selected.assumptions.map((item) => (
                <div key={item.id}>
                  <span>{item.text}</span>
                  <button
                    type="button"
                    onClick={() =>
                      persist(
                        removeOperatorScenarioAssumption(selected, item.id)
                      )
                    }
                  >
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="scenario-composer-actions">
            {selected.id === activeScenarioId ? (
              <button type="button" onClick={deactivate}>
                RETURN LIVE
              </button>
            ) : (
              <button type="button" onClick={() => activate(selected)}>
                ACTIVATE MODEL
              </button>
            )}
            <button type="button" onClick={() => onAnalyze(selected)}>
              ANALYZE WITH VÆLON
            </button>
            <button type="button" onClick={branchSelected}>
              BRANCH VERSION
            </button>
            <button
              type="button"
              onClick={() => downloadOperatorScenario(selected)}
            >
              EXPORT JSON
            </button>
            <button type="button" onClick={() => remove(selected.id)}>
              REMOVE
            </button>
          </div>
        </article>
      ) : null}

      <div className="analysis-boundary scenario-composer-boundary">
        <strong>HYPOTHETICAL MODEL · NOT LIVE / NOT FORECAST</strong>
        <span>
          Scenario parameters, assumptions, stress styling and modeled geometry
          are operator-authored analytical constructs. They are not provider
          telemetry, probabilistic forecasts, causal findings, or verified
          real-world outcomes.
        </span>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';

import type { TemporalMode } from '../renderer/spatial-renderer';
import {
  loadOperationalSnapshot,
  type OperationalSnapshot,
  type OperationalSourceSnapshot
} from '../services/operational-data-client';
import {
  clearOperationalSourceBindings,
  loadOperationalSourceBindings,
  saveOperationalSourceBindings,
  type OperationalSourceBindings
} from '../services/operational-source-bindings';
import {
  OPERATIONAL_TEMPORAL_CAPABILITIES,
  temporalSupportFor,
  type OperationalSourceId
} from '../time/operational-temporal-capabilities';
import { formatDataAge, formatSourceTime } from '../utils/data-freshness';

interface ExistingCurrentSource {
  live: boolean;
  state?: OperationalSourceSnapshot['state'];
  provider: string | null;
  sourceTime: string | null;
  fetchedAt: string | null;
  attribution: string | null;
  summary: string;
}

interface OperationalDataPanelProps {
  latitude: number;
  longitude: number;
  cityId: string;
  temporalMode: TemporalMode;
  cursorIso: string;
  weatherCurrent?: ExistingCurrentSource | null;
  airQualityCurrent?: ExistingCurrentSource | null;
  seismicCurrent?: ExistingCurrentSource | null;
}

function existingSourceSnapshot(
  id: OperationalSourceId,
  current: ExistingCurrentSource | null | undefined
): OperationalSourceSnapshot | null {
  if (!current) return null;
  return {
    id,
    state: current.state ?? (current.live ? 'live' : 'fallback'),
    provider: current.provider,
    dataset: null,
    sourceTime: current.sourceTime,
    fetchedAt: current.fetchedAt,
    attribution: current.attribution,
    summary: current.summary,
    metrics: [],
    error: null
  };
}

function sourceById(
  snapshot: OperationalSnapshot | null,
  id: OperationalSourceId,
  existing: OperationalSourceSnapshot | null
): OperationalSourceSnapshot | null {
  const candidate = snapshot?.sources.find((source) => source.id === id) ?? null;
  if (
    candidate?.state === 'live' ||
    candidate?.state === 'forecast' ||
    candidate?.state === 'stale'
  ) return candidate;
  if (
    existing?.state === 'live' ||
    existing?.state === 'forecast' ||
    existing?.state === 'stale'
  ) return existing;
  return candidate ?? existing;
}

export function OperationalDataPanel({
  latitude,
  longitude,
  cityId,
  temporalMode,
  cursorIso,
  weatherCurrent,
  airQualityCurrent,
  seismicCurrent
}: OperationalDataPanelProps) {
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [bindings, setBindings] = useState<OperationalSourceBindings>(() =>
    loadOperationalSourceBindings(cityId)
  );
  const [gaugeDraft, setGaugeDraft] = useState(bindings.gaugeId ?? '');
  const [energyRegionDraft, setEnergyRegionDraft] = useState(
    bindings.energyRegion ?? ''
  );
  const [bindingError, setBindingError] = useState<string | null>(null);

  const sampleKey = temporalMode === 'live' ? 'live' : cursorIso;

  useEffect(() => {
    const next = loadOperationalSourceBindings(cityId);
    setBindings(next);
    setGaugeDraft(next.gaugeId ?? '');
    setEnergyRegionDraft(next.energyRegion ?? '');
    setBindingError(null);
  }, [cityId]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      setLoading(true);
      void loadOperationalSnapshot({
        latitude,
        longitude,
        cityId,
        temporalMode,
        cursorIso: temporalMode === 'live' ? new Date().toISOString() : cursorIso,
        gaugeId: bindings.gaugeId,
        energyRegion: bindings.energyRegion,
        signal: controller.signal
      })
        .then((next) => {
          if (!controller.signal.aborted) setSnapshot(next);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    };

    refresh();
    const timer =
      temporalMode === 'live' ? globalThis.setInterval(refresh, 60_000) : null;

    return () => {
      controller.abort();
      if (timer != null) globalThis.clearInterval(timer);
    };
  }, [
    latitude,
    longitude,
    cityId,
    temporalMode,
    sampleKey,
    bindings.gaugeId,
    bindings.energyRegion
  ]);

  const liveCount = useMemo(
    () => snapshot?.sources.filter((source) => source.state === 'live').length ?? 0,
    [snapshot]
  );
  const forecastCount = useMemo(
    () =>
      temporalMode === 'forecast' && weatherCurrent?.state === 'forecast'
        ? 1
        : 0,
    [temporalMode, weatherCurrent]
  );

  const applyBindings = () => {
    try {
      const next = saveOperationalSourceBindings(cityId, {
        gaugeId: gaugeDraft,
        energyRegion: energyRegionDraft
      });
      setBindings(next);
      setGaugeDraft(next.gaugeId ?? '');
      setEnergyRegionDraft(next.energyRegion ?? '');
      setBindingError(null);
    } catch (error) {
      setBindingError(error instanceof Error ? error.message : String(error));
    }
  };

  const clearBindings = () => {
    const next = clearOperationalSourceBindings(cityId);
    setBindings(next);
    setGaugeDraft('');
    setEnergyRegionDraft('');
    setBindingError(null);
  };

  return (
    <section className="intel-card operational-data-panel">
      <div className="intel-head">
        <span className={liveCount > 0 ? 'status-dot live' : 'status-dot'} />
        <span>
          <small>OPERATIONAL DATA</small>
          <strong>{temporalMode.toUpperCase()}</strong>
        </span>
      </div>

      <p>
        {temporalMode === 'live'
          ? `${liveCount} source${liveCount === 1 ? '' : 's'} currently verified LIVE. Missing providers stay missing.`
          : temporalMode === 'forecast'
            ? `${forecastCount} provider-backed weather forecast sample${forecastCount === 1 ? '' : 's'} aligned to the selected 4D cursor. Current-only telemetry remains hidden.`
            : 'Only provider-backed samples valid for the selected 4D cursor may appear here; current-only telemetry is not replayed.'}
      </p>

      <section className="operational-source-bindings" aria-label="Operational source bindings">
        <div className="source-binding-head">
          <span>
            <small>SOURCE BINDINGS</small>
            <strong>OPERATOR SELECTED</strong>
          </span>
          <em>LIVE ONLY</em>
        </div>
        <p>
          NOAA gauge IDs and EIA region codes are never inferred from the map.
          Bind only identifiers you have verified for this operating context.
        </p>
        <div className="source-binding-grid">
          <label>
            <span>NOAA NWPS GAUGE ID</span>
            <input
              type="text"
              value={gaugeDraft}
              placeholder="e.g. NYCN6"
              maxLength={32}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) => setGaugeDraft(event.target.value.toUpperCase())}
            />
          </label>
          <label>
            <span>EIA REGION CODE</span>
            <input
              type="text"
              value={energyRegionDraft}
              placeholder="e.g. NYIS"
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(event) =>
                setEnergyRegionDraft(event.target.value.toUpperCase())
              }
            />
          </label>
        </div>
        <div className="source-binding-actions">
          <button type="button" onClick={applyBindings}>
            APPLY BINDINGS
          </button>
          <button type="button" onClick={clearBindings}>
            CLEAR
          </button>
        </div>
        {bindingError ? <p className="source-binding-error">{bindingError}</p> : null}
        <small>
          {bindings.updatedAt
            ? `BOUND ${formatDataAge(bindings.updatedAt)}`
            : 'NO MANUAL SOURCE BINDINGS'}
        </small>
      </section>

      <div className="provider-list">
        {OPERATIONAL_TEMPORAL_CAPABILITIES.map((capability) => {
          const existing =
            capability.id === 'weather'
              ? existingSourceSnapshot('weather', weatherCurrent)
              : capability.id === 'air-quality'
                ? existingSourceSnapshot('air-quality', airQualityCurrent)
                : capability.id === 'seismic'
                  ? existingSourceSnapshot('seismic', seismicCurrent)
                  : null;
          const source = sourceById(snapshot, capability.id, existing);
          const support = temporalSupportFor(capability, temporalMode);
          const state =
            temporalMode === 'live'
              ? source?.state ?? (loading ? 'loading' : support)
              : temporalMode === 'forecast' && source
                ? source.state
                : support;

          return (
            <article key={capability.id} className="provider-card" data-provider-state={state}>
              <header>
                <span>{capability.label}</span>
                <strong>{String(state).toUpperCase().replaceAll('-', ' ')}</strong>
              </header>

              {source?.metrics.length ? (
                <dl>
                  {source.metrics.map((metric) => (
                    <div key={metric.label}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <p>{source?.summary ?? capability.note}</p>
              <small>
                {source?.provider ?? 'PROVIDER PENDING'}
                {source?.dataset ? ` · ${source.dataset}` : ''}
              </small>
              <small>
                SOURCE {formatSourceTime(source?.sourceTime)} · FETCHED {formatDataAge(source?.fetchedAt)}
              </small>
            </article>
          );
        })}
      </div>

      <small className="selection-hint">
        NO SYNTHETIC TELEMETRY · NO CURRENT-ONLY DATA PROMOTED TO HISTORICAL OR FORECAST
      </small>
    </section>
  );
}

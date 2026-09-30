import { useEffect, useMemo, useState } from 'react';

import type { TemporalMode } from '../renderer/spatial-renderer';
import {
  loadOperationalSnapshot,
  type OperationalSnapshot,
  type OperationalSourceSnapshot
} from '../services/operational-data-client';
import {
  OPERATIONAL_TEMPORAL_CAPABILITIES,
  temporalSupportFor,
  type OperationalSourceId
} from '../time/operational-temporal-capabilities';
import { formatDataAge, formatSourceTime } from '../utils/data-freshness';

interface OperationalDataPanelProps {
  latitude: number;
  longitude: number;
  cityId: string;
  temporalMode: TemporalMode;
  cursorIso: string;
}

function sourceById(
  snapshot: OperationalSnapshot | null,
  id: OperationalSourceId
): OperationalSourceSnapshot | null {
  return snapshot?.sources.find((source) => source.id === id) ?? null;
}

export function OperationalDataPanel({
  latitude,
  longitude,
  cityId,
  temporalMode,
  cursorIso
}: OperationalDataPanelProps) {
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      setLoading(true);
      void loadOperationalSnapshot({
        latitude,
        longitude,
        cityId,
        temporalMode,
        cursorIso,
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
  }, [latitude, longitude, cityId, temporalMode, cursorIso]);

  const liveCount = useMemo(
    () => snapshot?.sources.filter((source) => source.state === 'live').length ?? 0,
    [snapshot]
  );

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
          : 'Only provider-backed samples valid for the selected 4D cursor may appear here; current-only telemetry is not replayed.'}
      </p>

      <div className="provider-list">
        {OPERATIONAL_TEMPORAL_CAPABILITIES.map((capability) => {
          const source = sourceById(snapshot, capability.id);
          const support = temporalSupportFor(capability, temporalMode);
          const state =
            support === 'available'
              ? source?.state ?? (loading ? 'loading' : 'unavailable')
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

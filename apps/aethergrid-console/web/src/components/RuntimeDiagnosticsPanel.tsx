import { useEffect, useState } from 'react';

import {
  loadRuntimeDiagnostics,
  type RuntimeDiagnostics
} from '../services/runtime-client';

interface ProviderRow {
  label: string;
  provider: string;
  state: 'ready' | 'fallback' | 'unconfigured';
  detail: string;
}

function rows(runtime: RuntimeDiagnostics | null): ProviderRow[] {
  if (!runtime) return [];

  const aiLive = runtime.ai?.liveProviders === true;
  return [
    {
      label: 'SPATIAL',
      provider: runtime.geospatial?.provider || 'unknown',
      state: runtime.geospatial?.configured === false ? 'unconfigured' : 'ready',
      detail: runtime.geospatial?.cacheTtlMs
        ? `CACHE ${Math.round(runtime.geospatial.cacheTtlMs / 1000)}s`
        : 'SOURCE RUNTIME'
    },
    {
      label: 'WEATHER',
      provider: runtime.environment?.provider || 'unknown',
      state: runtime.environment?.liveProviderConfigured ? 'ready' : 'fallback',
      detail: runtime.environment?.liveProviderConfigured ? 'LIVE CONFIG' : 'FALLBACK'
    },
    {
      label: 'AIR / SEISMIC',
      provider: `${runtime.liveContext?.airQualityProvider || 'air'} / ${runtime.liveContext?.seismicProvider || 'seismic'}`,
      state:
        runtime.liveContext?.liveAirQualityConfigured &&
        runtime.liveContext?.liveSeismicConfigured
          ? 'ready'
          : 'fallback',
      detail: 'LIVE CONTEXT'
    },
    {
      label: 'TERRAIN',
      provider: runtime.terrain?.provider || 'unknown',
      state: runtime.terrain?.configured === false ? 'unconfigured' : 'ready',
      detail: runtime.terrain?.resolutionMeters
        ? `~${runtime.terrain.resolutionMeters}m`
        : 'FALLBACK CAPABLE'
    },
    {
      label: 'AI',
      provider: runtime.ai?.mode || 'unknown',
      state: aiLive ? 'ready' : 'fallback',
      detail: aiLive ? 'EXTERNAL MODEL' : 'LOCAL FALLBACK'
    },
    {
      label: 'QUANTUM',
      provider: runtime.quantum?.provider || 'unknown',
      state: runtime.quantum?.configured === false ? 'unconfigured' : 'ready',
      detail: runtime.quantum?.hardwareExecution ? 'HARDWARE PATH' : 'LOCAL SIMULATOR'
    }
  ];
}

export function RuntimeDiagnosticsPanel() {
  const [runtime, setRuntime] = useState<RuntimeDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    const controller = new AbortController();
    setError(null);
    void loadRuntimeDiagnostics(controller.signal)
      .then(setRuntime)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      );
    return () => controller.abort();
  };

  useEffect(() => refresh(), []);

  const exposedSecret =
    runtime?.geospatial?.credentialsExposed ||
    runtime?.environment?.credentialsExposed ||
    runtime?.liveContext?.credentialsExposed ||
    runtime?.terrain?.credentialsExposed ||
    runtime?.quantum?.credentialsExposed;

  return (
    <section className="runtime-panel">
      <div className="runtime-head">
        <span>
          <small>RUNTIME</small>
          <strong>PROVIDER DIAGNOSTICS</strong>
        </span>
        <button type="button" onClick={refresh} aria-label="Refresh runtime diagnostics">
          ↻
        </button>
      </div>

      <div className="runtime-list">
        {rows(runtime).map((item) => (
          <div key={item.label}>
            <span className={`runtime-state ${item.state}`} />
            <span>
              <small>{item.label}</small>
              <strong>{item.provider}</strong>
            </span>
            <em>{item.detail}</em>
          </div>
        ))}
      </div>

      <div className={exposedSecret ? 'runtime-secret warning' : 'runtime-secret'}>
        <span>CLIENT SECRET EXPOSURE</span>
        <strong>{exposedSecret ? 'WARNING' : 'NONE REPORTED'}</strong>
      </div>

      {error ? <div className="agent-error">{error}</div> : null}
    </section>
  );
}

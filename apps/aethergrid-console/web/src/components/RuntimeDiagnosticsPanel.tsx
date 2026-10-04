import { useEffect, useMemo, useState } from 'react';

import {
  loadPublicProviderRuntime,
  loadRuntimeDiagnostics,
  type PublicProviderCapability,
  type PublicProviderRuntime,
  type RuntimeDiagnostics
} from '../services/runtime-client';

type ProviderState =
  | 'ready'
  | 'configured'
  | 'degraded'
  | 'fallback'
  | 'unavailable'
  | 'unconfigured';

interface ProviderRow {
  id: keyof PublicProviderRuntime;
  label: string;
  provider: string;
  state: ProviderState;
  detail: string;
}

const PROVIDER_LABELS: ReadonlyArray<{
  id: keyof PublicProviderRuntime;
  label: string;
  fallbackProvider: string;
}> = [
  { id: 'spatial', label: 'SPATIAL', fallbackProvider: 'native-webgl' },
  { id: 'geo', label: 'GEOSPATIAL', fallbackProvider: 'osm-overpass' },
  { id: 'terrain', label: 'TERRAIN', fallbackProvider: 'open-meteo' },
  { id: 'weather', label: 'WEATHER', fallbackProvider: 'open-meteo' },
  { id: 'airQuality', label: 'AIR QUALITY', fallbackProvider: 'open-meteo' },
  { id: 'seismic', label: 'SEISMIC', fallbackProvider: 'usgs' },
  { id: 'hazards', label: 'HAZARDS', fallbackProvider: 'nws' },
  { id: 'hydrology', label: 'HYDROLOGY', fallbackProvider: 'noaa-nwps' },
  { id: 'energy', label: 'ENERGY', fallbackProvider: 'eia' },
  { id: 'transit', label: 'TRANSIT', fallbackProvider: 'gtfs-rt-registry' },
  { id: 'quantum', label: 'QUANTUM', fallbackProvider: 'ibm / dwave' },
  { id: 'ai', label: 'AI', fallbackProvider: 'local-ai' }
];

function normalizeState(status: string | undefined): ProviderState {
  switch (status) {
    case 'ready':
    case 'configured':
    case 'degraded':
    case 'fallback':
    case 'unavailable':
    case 'unconfigured':
      return status;
    default:
      return 'unconfigured';
  }
}

function providerDetail(
  capability: PublicProviderCapability | undefined,
  state: ProviderState
): string {
  if (capability?.hardwareEnabled) return 'HARDWARE ENABLED';
  switch (state) {
    case 'ready':
      return 'READY · NOT LIVE VERIFIED';
    case 'configured':
      return 'CONFIGURED';
    case 'degraded':
      return 'DEGRADED';
    case 'fallback':
      return 'FALLBACK';
    case 'unavailable':
      return 'UNAVAILABLE';
    default:
      return 'NEEDS CONFIG';
  }
}

function rows(providers: PublicProviderRuntime | null): ProviderRow[] {
  if (!providers) return [];
  return PROVIDER_LABELS.map(({ id, label, fallbackProvider }) => {
    const capability = providers[id];
    const state = normalizeState(capability?.status);
    return {
      id,
      label,
      provider: capability?.provider || fallbackProvider,
      state,
      detail: providerDetail(capability, state)
    };
  });
}

export function RuntimeDiagnosticsPanel() {
  const [runtime, setRuntime] = useState<RuntimeDiagnostics | null>(null);
  const [providers, setProviders] = useState<PublicProviderRuntime | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void Promise.all([
      loadRuntimeDiagnostics(controller.signal),
      loadPublicProviderRuntime(controller.signal)
    ])
      .then(([runtimeResult, providerResult]) => {
        setRuntime(runtimeResult);
        setProviders(providerResult);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      )
      .finally(() => setLoading(false));
    return () => controller.abort();
  };

  useEffect(() => refresh(), []);

  const providerRows = useMemo(() => rows(providers), [providers]);
  const exposedSecret =
    runtime?.geospatial?.credentialsExposed ||
    runtime?.environment?.credentialsExposed ||
    runtime?.liveContext?.credentialsExposed ||
    runtime?.terrain?.credentialsExposed ||
    runtime?.quantum?.credentialsExposed;

  const configuredCount = providerRows.filter(
    (item) => item.state === 'ready' || item.state === 'configured'
  ).length;
  const attentionCount = providerRows.filter(
    (item) => item.state === 'degraded' || item.state === 'fallback' || item.state === 'unavailable'
  ).length;

  return (
    <section className="runtime-panel provider-connection-center">
      <div className="runtime-head">
        <span>
          <small>CONNECTION CENTER</small>
          <strong>PROVIDER READINESS</strong>
        </span>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh provider connections"
          disabled={loading}
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      <div className="provider-connection-summary">
        <span>
          <small>READY / CONFIGURED</small>
          <strong>{configuredCount}</strong>
        </span>
        <span>
          <small>ATTENTION</small>
          <strong>{attentionCount}</strong>
        </span>
        <span>
          <small>TOTAL</small>
          <strong>{providerRows.length}</strong>
        </span>
      </div>

      <div className="runtime-list provider-runtime-list">
        {providerRows.map((item) => (
          <div key={item.id} data-provider-capability={item.id}>
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

      <p className="provider-connection-note">
        Configuration and readiness do not prove a successful live request. Status comes from the server-side provider registry. Credentials remain server-side and
        are never rendered here.
      </p>

      {error ? <div className="agent-error">{error}</div> : null}
    </section>
  );
}

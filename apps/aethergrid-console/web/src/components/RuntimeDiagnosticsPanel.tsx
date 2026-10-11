import { useMemo } from 'react';
import { useProviderReadiness } from '../hooks/use-provider-readiness';

import {
  type PublicProviderCapability,
  type PublicProviderRuntime,
} from '../services/runtime-client';

type ProviderState =
  | 'ready'
  | 'configured'
  | 'degraded'
  | 'fallback'
  | 'unavailable'
  | 'unconfigured'
  | 'unknown';

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
      return 'unknown';
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
    case 'unknown':
      return 'UNKNOWN';
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
  const { runtime, providers, loading, error, checkedAt, refresh } = useProviderReadiness();

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
    <section className="runtime-panel provider-connection-center" aria-busy={loading} data-registry-state={error ? (providers ? 'stale' : 'unavailable') : loading ? 'loading' : 'checked'}>
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

      <p className="provider-connection-note" role="status">
        REGISTRY CHECKED: {checkedAt ? new Date(checkedAt).toLocaleString() : 'NOT YET'}
        {error && providers ? ' · STALE REGISTRY · PREVIOUS CONFIGURATION ONLY' : ''}
      </p>

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

      <p className="provider-connection-note">
        IBM: {providers?.quantum?.providers?.ibm?.configured ? 'CONFIGURED · NOT LIVE VERIFIED' : 'UNCONFIGURED · VERIFIED INSTANCE REQUIRED'}.
        {' '}D-Wave: ON HOLD · NON-EXECUTABLE.
        {' '}Local quantum: SIMULATION.
      </p>
      <p className="provider-connection-note">
        Last successful request, latency, cache age and circuit state: UNKNOWN.
        The readiness endpoint does not supply these measurements. Source receipts in OPS show the results of actual data requests.
      </p>

      {error ? <div className="agent-error" role="alert">{error}</div> : null}
    </section>
  );
}

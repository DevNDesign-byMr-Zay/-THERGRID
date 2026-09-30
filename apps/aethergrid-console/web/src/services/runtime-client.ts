export interface RuntimeDiagnostics {
  ai?: {
    mode?: string;
    liveProviders?: boolean;
    supportedProviders?: readonly string[];
    agents?: Readonly<Record<string, {
      provider?: string;
      model?: string | null;
      status?: string;
    }>>;
  };
  geospatial?: {
    provider?: string;
    configured?: boolean;
    cacheTtlMs?: number;
    credentialsExposed?: boolean;
  };
  environment?: {
    provider?: string;
    liveProviderConfigured?: boolean;
    credentialsExposed?: boolean;
  };
  liveContext?: {
    airQualityProvider?: string;
    seismicProvider?: string;
    liveAirQualityConfigured?: boolean;
    liveSeismicConfigured?: boolean;
    credentialsExposed?: boolean;
  };
  terrain?: {
    provider?: string;
    configured?: boolean;
    credentialsExposed?: boolean;
    resolutionMeters?: number | null;
  };
  quantum?: {
    provider?: string;
    configured?: boolean;
    hardwareExecution?: boolean;
    credentialsExposed?: boolean;
    defaultBackend?: string | null;
  };
}

export async function loadRuntimeDiagnostics(
  signal?: AbortSignal
): Promise<RuntimeDiagnostics> {
  const response = await fetch('/api/aethergrid/runtime', {
    headers: { accept: 'application/json' },
    signal
  });
  const payload = (await response.json().catch(() => ({}))) as RuntimeDiagnostics & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || `runtime diagnostics failed with HTTP ${response.status}`);
  }
  return payload;
}

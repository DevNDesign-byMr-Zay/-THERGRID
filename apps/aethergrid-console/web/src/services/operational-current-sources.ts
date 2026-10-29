import {
  weatherPhenomenon,
  type AtmosphericOverlaySnapshot
} from '../renderer/overlays/atmospheric-overlay';
import type { TemporalMode } from '../renderer/spatial-renderer';
import type { CityLiveSnapshot } from './city-live-context';
import type { OperationalSourceSnapshot } from './operational-data-client';

export interface ExistingCurrentSource {
  live: boolean;
  state?: OperationalSourceSnapshot['state'];
  provider: string | null;
  sourceTime: string | null;
  fetchedAt: string | null;
  attribution: string | null;
  summary: string;
}

export function operationalCurrentSources({
  temporalMode,
  atmosphere,
  liveContext
}: {
  temporalMode: TemporalMode;
  atmosphere: AtmosphericOverlaySnapshot | null;
  liveContext: CityLiveSnapshot | null;
}): {
  weatherCurrent: ExistingCurrentSource | null;
  airQualityCurrent: ExistingCurrentSource | null;
  seismicCurrent: ExistingCurrentSource | null;
} {
  const weatherCurrent: ExistingCurrentSource | null = atmosphere
    ? {
        live: temporalMode === 'live' && atmosphere.live && !atmosphere.fallback && !atmosphere.stale,
        state:
          temporalMode === 'forecast'
            ? atmosphere.stale
              ? 'stale'
              : atmosphere.fallback
                ? 'fallback'
                : 'forecast'
            : atmosphere.stale
              ? 'stale'
              : atmosphere.fallback
                ? 'fallback'
                : undefined,
        provider: atmosphere.attribution,
        sourceTime: atmosphere.sourceTime,
        fetchedAt: atmosphere.fetchedAt,
        attribution: atmosphere.attribution,
        summary:
          temporalMode === 'forecast'
            ? `${weatherPhenomenon(atmosphere).toUpperCase()} FORECAST`
            : weatherPhenomenon(atmosphere).toUpperCase()
      }
    : null;

  const airQualityCurrent: ExistingCurrentSource | null = liveContext
    ? {
        live: liveContext.airQuality.source.live,
        provider: liveContext.airQuality.source.provider,
        sourceTime:
          liveContext.airQuality.source.modelTime ??
          liveContext.airQuality.current?.time ??
          null,
        fetchedAt: liveContext.airQuality.source.fetchedAt,
        attribution: liveContext.airQuality.source.attribution,
        summary:
          liveContext.airQuality.current?.usAqi != null
            ? `AQI ${liveContext.airQuality.current.usAqi.toFixed(0)}`
            : 'AIR QUALITY SOURCE'
      }
    : null;

  const seismicCurrent: ExistingCurrentSource | null = liveContext
    ? {
        live: liveContext.seismic.source.live,
        provider: liveContext.seismic.source.provider,
        sourceTime: liveContext.seismic.source.generatedAt ?? null,
        fetchedAt: liveContext.seismic.source.fetchedAt,
        attribution: liveContext.seismic.source.attribution,
        summary: `${liveContext.seismic.eventCount} RECENT EVENTS`
      }
    : null;

  return { weatherCurrent, airQualityCurrent, seismicCurrent };
}

import type { AirQualityOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type {
  SpatialOverlayNode,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

export interface AirQualitySnapshot {
  source: {
    provider: string | null;
    live: boolean;
    attribution: string | null;
    fetchedAt: string | null;
    modelTime: string | null;
  };
  current: {
    time: string | null;
    usAqi: number | null;
    europeanAqi: number | null;
    category: string;
    pm25UgM3: number | null;
    pm10UgM3: number | null;
    ozoneUgM3: number | null;
    nitrogenDioxideUgM3: number | null;
    dustUgM3: number | null;
    uvIndex: number | null;
  } | null;
}

export interface SeismicEvent {
  id: string;
  lat: number;
  lon: number;
  depthKm: number | null;
  magnitude: number;
  place: string;
  time: string | null;
  updated: string | null;
  distanceKm: number;
}

export interface CityLiveSnapshot {
  coordinate: { lat: number; lon: number };
  airQuality: AirQualitySnapshot;
  seismic: {
    source: {
      provider: string | null;
      live: boolean;
      attribution: string | null;
      fetchedAt: string | null;
      generatedAt?: string | null;
    };
    radiusKm: number;
    events: readonly SeismicEvent[];
    eventCount: number;
    maxMagnitude: number | null;
    nearestDistanceKm: number | null;
  };
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}


export function airQualityToOverlay(
  snapshot: CityLiveSnapshot,
  wind: {
    windSpeedKph?: number | null;
    windDirectionDegrees?: number | null;
  } = {}
): AirQualityOverlaySnapshot {
  const source = snapshot.airQuality.source;
  const current = snapshot.airQuality.current;
  const fetchedAt = source.fetchedAt ?? new Date().toISOString();
  return {
    id: `air:${snapshot.coordinate.lat}:${snapshot.coordinate.lon}:${fetchedAt}`,
    coordinate: {
      latitude: snapshot.coordinate.lat,
      longitude: snapshot.coordinate.lon
    },
    eventTime: source.modelTime ?? current?.time ?? fetchedAt,
    sourceTime: source.modelTime ?? current?.time ?? null,
    fetchedAt,
    live: source.live === true,
    fallback: source.live !== true,
    attribution: source.attribution ?? source.provider,
    current: current
      ? {
          usAqi: current.usAqi,
          category: current.category,
          pm25UgM3: current.pm25UgM3,
          pm10UgM3: current.pm10UgM3,
          ozoneUgM3: current.ozoneUgM3,
          windSpeedKph: finite(wind.windSpeedKph),
          windDirectionDegrees: finite(wind.windDirectionDegrees)
        }
      : null
  };
}

export function seismicToOverlay(snapshot: CityLiveSnapshot): SpatialOverlaySnapshot {
  const source = snapshot.seismic.source;
  const nodes: SpatialOverlayNode[] = snapshot.seismic.events.map((event) => ({
    id: `seismic:${event.id}`,
    kind: 'event',
    position: {
      latitude: event.lat,
      longitude: event.lon,
      heightMeters: 140
    },
    label: event.place || `M${event.magnitude.toFixed(1)} earthquake`,
    value: event.magnitude,
    unit: 'M',
    intensity: Math.min(1, Math.max(0.18, event.magnitude / 8)),
    validFrom: event.time,
    properties: {
      eventType: 'earthquake',
      magnitude: event.magnitude,
      depthKm: event.depthKm,
      place: event.place,
      distanceKm: event.distanceKm,
      updated: event.updated
    }
  }));

  const fetchedAt = source.fetchedAt ?? new Date().toISOString();
  return {
    id: `seismic:${snapshot.coordinate.lat}:${snapshot.coordinate.lon}:${fetchedAt}`,
    layerId: 'seismic',
    eventTime:
      nodes
        .map((node) => node.validFrom)
        .find((value): value is string => typeof value === 'string') ?? fetchedAt,
    sourceTime: source.generatedAt ?? null,
    fetchedAt,
    live: source.live === true,
    stale: false,
    fallback: source.live !== true,
    attribution: source.attribution ?? source.provider,
    nodes,
    edges: []
  };
}

export async function loadCityLiveContext(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<CityLiveSnapshot> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    radiusKm: '1200'
  });
  const response = await fetch(`/api/aethergrid/city-live?${query.toString()}`, {
    headers: { accept: 'application/json' },
    signal
  });
  if (!response.ok) {
    throw new Error(`city live context request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Partial<CityLiveSnapshot>;
  const air = payload.airQuality ?? {
    source: {
      provider: null,
      live: false,
      attribution: null,
      fetchedAt: null,
      modelTime: null
    },
    current: null
  };
  const seismic = payload.seismic ?? {
    source: {
      provider: null,
      live: false,
      attribution: null,
      fetchedAt: null,
      generatedAt: null
    },
    radiusKm: 1200,
    events: [],
    eventCount: 0,
    maxMagnitude: null,
    nearestDistanceKm: null
  };

  return {
    coordinate: {
      lat: finite(payload.coordinate?.lat) ?? latitude,
      lon: finite(payload.coordinate?.lon) ?? longitude
    },
    airQuality: {
      source: {
        provider: air.source?.provider ?? null,
        live: air.source?.live === true,
        attribution: air.source?.attribution ?? null,
        fetchedAt: air.source?.fetchedAt ?? null,
        modelTime: air.source?.modelTime ?? null
      },
      current: air.current
        ? {
            time: air.current.time ?? null,
            usAqi: finite(air.current.usAqi),
            europeanAqi: finite(air.current.europeanAqi),
            category: String(air.current.category || 'unknown'),
            pm25UgM3: finite(air.current.pm25UgM3),
            pm10UgM3: finite(air.current.pm10UgM3),
            ozoneUgM3: finite(air.current.ozoneUgM3),
            nitrogenDioxideUgM3: finite(air.current.nitrogenDioxideUgM3),
            dustUgM3: finite(air.current.dustUgM3),
            uvIndex: finite(air.current.uvIndex)
          }
        : null
    },
    seismic: {
      source: {
        provider: seismic.source?.provider ?? null,
        live: seismic.source?.live === true,
        attribution: seismic.source?.attribution ?? null,
        fetchedAt: seismic.source?.fetchedAt ?? null,
        generatedAt: seismic.source?.generatedAt ?? null
      },
      radiusKm: finite(seismic.radiusKm) ?? 1200,
      events: (seismic.events ?? [])
        .map((event) => ({
          id: String(event.id || ''),
          lat: finite(event.lat) ?? 0,
          lon: finite(event.lon) ?? 0,
          depthKm: finite(event.depthKm),
          magnitude: finite(event.magnitude) ?? 0,
          place: String(event.place || ''),
          time: event.time ?? null,
          updated: event.updated ?? null,
          distanceKm: finite(event.distanceKm) ?? 0
        }))
        .filter((event) => event.id && Number.isFinite(event.lat) && Number.isFinite(event.lon)),
      eventCount: finite(seismic.eventCount) ?? 0,
      maxMagnitude: finite(seismic.maxMagnitude),
      nearestDistanceKm: finite(seismic.nearestDistanceKm)
    }
  };
}

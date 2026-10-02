import type {
  SpatialOverlayNode,
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

interface GlobalCityContext {
  id: string;
  name: string;
  lat: number;
  lon: number;
  airQuality?: {
    usAqi?: number | null;
    category?: string;
  } | null;
  source?: {
    provider?: string;
    live?: boolean;
    attribution?: string | null;
    fetchedAt?: string | null;
    modelTime?: string | null;
  };
}

interface GlobalSeismicEvent {
  id: string;
  lat: number;
  lon: number;
  depthKm?: number | null;
  magnitude: number;
  place?: string;
  time?: string | null;
}

interface GlobalLiveResponse {
  generatedAt?: string;
  cities?: GlobalCityContext[];
  seismic?: {
    source?: {
      provider?: string;
      live?: boolean;
      attribution?: string | null;
      fetchedAt?: string | null;
      generatedAt?: string | null;
    };
    events?: GlobalSeismicEvent[];
    eventCount?: number;
  };
}

function finite(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function aqiIntensity(value: unknown): number {
  const aqi = finite(value, 0);
  return Math.min(1, Math.max(0.16, aqi / 250));
}

export interface GlobalLiveContext {
  overlay: SpatialOverlaySnapshot;
  cityCount: number;
  earthquakeCount: number;
  maxMagnitude: number | null;
  generatedAt: string;
}

export async function loadGlobalLiveContext(
  signal?: AbortSignal
): Promise<GlobalLiveContext> {
  const response = await fetch('/api/aethergrid/global-live', {
    headers: { accept: 'application/json' },
    signal
  });
  const payload = (await response.json().catch(() => ({}))) as GlobalLiveResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || `global live request failed with HTTP ${response.status}`);
  }

  const generatedAt = payload.generatedAt || new Date().toISOString();
  const cities = payload.cities || [];
  const events = payload.seismic?.events || [];

  const cityNodes: SpatialOverlayNode[] = cities.map((city) => ({
    id: `world-city:${city.id}`,
    kind: 'city',
    position: {
      latitude: finite(city.lat),
      longitude: finite(city.lon),
      heightMeters: 18_000
    },
    label: city.name,
    value: finite(city.airQuality?.usAqi, 0),
    unit: 'US AQI',
    intensity: aqiIntensity(city.airQuality?.usAqi),
    properties: {
      cityId: city.id,
      category: city.airQuality?.category || 'unknown',
      provider: city.source?.provider || null,
      sourceTime: city.source?.modelTime || null
    }
  }));

  const seismicNodes: SpatialOverlayNode[] = events.map((event) => ({
    id: `world-earthquake:${event.id}`,
    kind: 'event',
    position: {
      latitude: finite(event.lat),
      longitude: finite(event.lon),
      heightMeters: 26_000
    },
    label: event.place || `M${finite(event.magnitude).toFixed(1)} earthquake`,
    value: finite(event.magnitude),
    unit: 'M',
    intensity: Math.min(1, Math.max(0.18, finite(event.magnitude) / 8)),
    validFrom: event.time || null,
    properties: {
      eventType: 'earthquake',
      depthKm: event.depthKm ?? null,
      magnitude: finite(event.magnitude),
      place: event.place || ''
    }
  }));

  const maxMagnitude = events.length
    ? Math.max(...events.map((event) => finite(event.magnitude)))
    : null;
  const source = payload.seismic?.source;

  return {
    overlay: {
      id: `world-live:${generatedAt}`,
      layerId: 'world',
      eventTime: generatedAt,
      sourceTime: source?.generatedAt || generatedAt,
      fetchedAt: source?.fetchedAt || generatedAt,
      live:
        cities.some((city) => city.source?.live === true) ||
        source?.live === true,
      stale: false,
      fallback:
        !cities.some((city) => city.source?.live === true) &&
        source?.live !== true,
      attribution:
        [cities[0]?.source?.attribution, source?.attribution]
          .filter(Boolean)
          .join(' · ') || null,
      nodes: [...cityNodes, ...seismicNodes],
      edges: []
    },
    cityCount: cities.length,
    earthquakeCount: finite(payload.seismic?.eventCount, events.length),
    maxMagnitude,
    generatedAt
  };
}

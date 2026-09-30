const DEFAULT_AIR_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const DEFAULT_SEISMIC_ENDPOINT =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

function validateCoordinate(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${label} must be between ${min} and ${max}`);
    error.status = 400;
    throw error;
  }
  return number;
}

function validateEndpoint(value, label) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error(`${label} URL must be HTTP(S)`);
  }
  return url;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function airCategory(usAqi) {
  const value = finite(usAqi);
  if (value == null) return 'unknown';
  if (value <= 50) return 'good';
  if (value <= 100) return 'moderate';
  if (value <= 150) return 'unhealthy-sensitive';
  if (value <= 200) return 'unhealthy';
  if (value <= 300) return 'very-unhealthy';
  return 'hazardous';
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function localOffsetMeters(originLat, originLon, lat, lon) {
  const latScale = 111_320;
  const lonScale = 111_320 * Math.cos((originLat * Math.PI) / 180);
  return {
    x: (lon - originLon) * lonScale,
    z: -(lat - originLat) * latScale,
  };
}

function airFallback(lat, lon, error = null) {
  return {
    coordinate: { lat, lon },
    source: {
      provider: 'local-air-quality-fallback',
      live: false,
      attribution: null,
      fetchedAt: new Date().toISOString(),
      error: error ? (error instanceof Error ? error.message : String(error)) : null,
    },
    current: null,
  };
}

function seismicFallback(error = null) {
  return {
    source: {
      provider: 'local-seismic-fallback',
      live: false,
      attribution: null,
      fetchedAt: new Date().toISOString(),
      error: error ? (error instanceof Error ? error.message : String(error)) : null,
    },
    events: [],
  };
}

export function createCityLiveRuntime({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  const airProvider = String(env.AETHERGRID_AIR_QUALITY_PROVIDER || 'open-meteo').toLowerCase();
  const seismicProvider = String(env.AETHERGRID_SEISMIC_PROVIDER || 'usgs').toLowerCase();
  const airEndpoint = String(env.AETHERGRID_AIR_QUALITY_URL || DEFAULT_AIR_ENDPOINT);
  const seismicEndpoint = String(env.AETHERGRID_USGS_EARTHQUAKE_URL || DEFAULT_SEISMIC_ENDPOINT);
  const seismicCacheTtlMs = Math.max(
    30_000,
    Math.min(15 * 60_000, Number(env.AETHERGRID_SEISMIC_CACHE_TTL_MS || 60_000)),
  );
  let seismicCache = null;

  function summary() {
    return {
      airQualityProvider: airProvider,
      seismicProvider,
      liveAirQualityConfigured: airProvider === 'open-meteo',
      liveSeismicConfigured: seismicProvider === 'usgs',
      airQualityEndpoint: airProvider === 'open-meteo' ? new URL(airEndpoint).origin : null,
      seismicEndpoint: seismicProvider === 'usgs' ? new URL(seismicEndpoint).origin : null,
      airVariables: [
        'us_aqi',
        'european_aqi',
        'pm2_5',
        'pm10',
        'ozone',
        'nitrogen_dioxide',
        'dust',
        'uv_index',
      ],
      seismicFeed: 'M2.5+ past day GeoJSON',
      seismicCacheTtlMs,
      credentialsExposed: false,
      attribution: ['Open-Meteo Air Quality', 'USGS Earthquake Hazards Program'],
    };
  }

  async function airQuality({ lat, lon }) {
    const latitude = validateCoordinate(lat, -90, 90, 'latitude');
    const longitude = validateCoordinate(lon, -180, 180, 'longitude');
    if (airProvider !== 'open-meteo') return airFallback(latitude, longitude);
    try {
      const url = validateEndpoint(airEndpoint, 'air quality');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set(
        'current',
        [
          'us_aqi',
          'european_aqi',
          'pm2_5',
          'pm10',
          'ozone',
          'nitrogen_dioxide',
          'dust',
          'uv_index',
        ].join(','),
      );
      url.searchParams.set('timezone', 'auto');
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'AETHERGRID/2.7 (city-live-runtime)',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Open-Meteo air quality HTTP ${response.status}`);
      const payload = await response.json();
      const current = payload?.current || {};
      const usAqi = finite(current.us_aqi);
      return {
        coordinate: { lat: latitude, lon: longitude },
        timezone: payload?.timezone || null,
        source: {
          provider: 'Open-Meteo Air Quality',
          live: true,
          attribution: 'Air quality data via Open-Meteo / CAMS',
          fetchedAt: new Date(now()).toISOString(),
          modelTime: current.time || null,
        },
        current: {
          time: current.time || null,
          usAqi,
          europeanAqi: finite(current.european_aqi),
          category: airCategory(usAqi),
          pm25UgM3: finite(current.pm2_5),
          pm10UgM3: finite(current.pm10),
          ozoneUgM3: finite(current.ozone),
          nitrogenDioxideUgM3: finite(current.nitrogen_dioxide),
          dustUgM3: finite(current.dust),
          uvIndex: finite(current.uv_index),
        },
      };
    } catch (error) {
      return airFallback(latitude, longitude, error);
    }
  }

  async function earthquakes({ force = false } = {}) {
    if (seismicProvider !== 'usgs') return seismicFallback();
    if (!force && seismicCache && now() - seismicCache.at < seismicCacheTtlMs) {
      return seismicCache.value;
    }
    try {
      const url = validateEndpoint(seismicEndpoint, 'USGS earthquake');
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/geo+json, application/json',
          'user-agent': 'AETHERGRID/2.7 (city-live-runtime)',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`USGS earthquake feed HTTP ${response.status}`);
      const payload = await response.json();
      const events = (payload?.features || [])
        .map((feature) => {
          const [lon, lat, depthKm] = feature?.geometry?.coordinates || [];
          const magnitude = finite(feature?.properties?.mag);
          if (![lat, lon].every((value) => Number.isFinite(Number(value))) || magnitude == null) {
            return null;
          }
          return {
            id: String(feature.id || ''),
            lat: Number(lat),
            lon: Number(lon),
            depthKm: finite(depthKm),
            magnitude,
            place: String(feature?.properties?.place || ''),
            time: Number.isFinite(Number(feature?.properties?.time))
              ? new Date(Number(feature.properties.time)).toISOString()
              : null,
            updated: Number.isFinite(Number(feature?.properties?.updated))
              ? new Date(Number(feature.properties.updated)).toISOString()
              : null,
            url: String(feature?.properties?.url || ''),
          };
        })
        .filter(Boolean)
        .sort((left, right) => (right.magnitude || 0) - (left.magnitude || 0));
      const value = {
        source: {
          provider: 'USGS Earthquake Hazards Program',
          live: true,
          attribution: 'USGS Earthquake Hazards Program',
          fetchedAt: new Date(now()).toISOString(),
          generatedAt: Number.isFinite(Number(payload?.metadata?.generated))
            ? new Date(Number(payload.metadata.generated)).toISOString()
            : null,
          feedTitle: payload?.metadata?.title || 'M2.5+ earthquakes, past day',
        },
        events,
      };
      seismicCache = { at: now(), value };
      return value;
    } catch (error) {
      return seismicFallback(error);
    }
  }

  async function citySnapshot({ lat, lon, radiusKm = 1200, force = false } = {}) {
    const latitude = validateCoordinate(lat, -90, 90, 'latitude');
    const longitude = validateCoordinate(lon, -180, 180, 'longitude');
    const boundedRadiusKm = Math.max(50, Math.min(3000, Number(radiusKm || 1200)));
    const [air, seismic] = await Promise.all([
      airQuality({ lat: latitude, lon: longitude }),
      earthquakes({ force }),
    ]);
    const nearbySeismic = seismic.events
      .map((event) => {
        const distanceKm = haversineKm(latitude, longitude, event.lat, event.lon);
        if (distanceKm > boundedRadiusKm) return null;
        return {
          ...event,
          distanceKm: Number(distanceKm.toFixed(1)),
          offsetM: localOffsetMeters(latitude, longitude, event.lat, event.lon),
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const magnitudeDelta = (right.magnitude || 0) - (left.magnitude || 0);
        return magnitudeDelta || (left.distanceKm || 0) - (right.distanceKm || 0);
      })
      .slice(0, 24);
    return {
      schemaVersion: 1,
      coordinate: { lat: latitude, lon: longitude },
      airQuality: air,
      seismic: {
        source: seismic.source,
        radiusKm: boundedRadiusKm,
        events: nearbySeismic,
        eventCount: nearbySeismic.length,
        maxMagnitude: nearbySeismic.length
          ? Math.max(...nearbySeismic.map((event) => Number(event.magnitude || 0)))
          : null,
        nearestDistanceKm: nearbySeismic.length
          ? Math.min(...nearbySeismic.map((event) => Number(event.distanceKm || 0)))
          : null,
      },
    };
  }

  async function globalSnapshot(cities = [], { force = false } = {}) {
    const seismic = await earthquakes({ force });
    const cityAir = await Promise.all(
      cities.slice(0, 24).map(async (city) => {
        const air = await airQuality({ lat: city.lat, lon: city.lon });
        return {
          id: city.id,
          name: city.name,
          lat: Number(city.lat),
          lon: Number(city.lon),
          airQuality: air.current,
          source: air.source,
        };
      }),
    );
    return {
      schemaVersion: 1,
      generatedAt: new Date(now()).toISOString(),
      cities: cityAir,
      seismic: {
        source: seismic.source,
        events: seismic.events.slice(0, 160),
        eventCount: seismic.events.length,
      },
    };
  }

  return {
    summary,
    airQuality,
    earthquakes,
    citySnapshot,
    globalSnapshot,
  };
}

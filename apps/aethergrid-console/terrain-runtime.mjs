function safeUrl(value, label) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP(S)`);
  }
  return url;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validatePoint(input = {}) {
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    const error = new Error('terrain latitude must be between -90 and 90');
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    const error = new Error('terrain longitude must be between -180 and 180');
    error.status = 400;
    throw error;
  }
  return {
    lat,
    lon,
    radiusM: clamp(Number(input.radiusM) || 900, 250, 2000),
    gridSize: Math.round(clamp(Number(input.gridSize) || 7, 3, 9)),
  };
}

function sampleGrid({ lat, lon, radiusM, gridSize }) {
  const latMeters = 111_320;
  const lonMeters = Math.max(1, Math.cos((lat * Math.PI) / 180) * 111_320);
  const points = [];
  for (let row = 0; row < gridSize; row += 1) {
    const z = -radiusM + (row / (gridSize - 1)) * radiusM * 2;
    for (let column = 0; column < gridSize; column += 1) {
      const x = -radiusM + (column / (gridSize - 1)) * radiusM * 2;
      points.push({
        x,
        z,
        lat: lat + z / latMeters,
        lon: lon + x / lonMeters,
      });
    }
  }
  return points;
}

function fallbackTerrain(input) {
  const points = sampleGrid(input).map((point) => ({
    ...point,
    elevationM: 0,
    relativeElevationM: 0,
  }));
  return {
    schemaVersion: 1,
    source: {
      provider: 'flat-local-fallback',
      live: false,
      attribution: null,
    },
    center: { lat: input.lat, lon: input.lon },
    radiusM: input.radiusM,
    gridSize: input.gridSize,
    minElevationM: 0,
    maxElevationM: 0,
    points,
  };
}

export function createTerrainRuntime({ env = process.env, fetchImpl = fetch } = {}) {
  const provider = String(env.AETHERGRID_TERRAIN_PROVIDER || 'open-meteo').toLowerCase();
  const endpoint = String(
    env.AETHERGRID_ELEVATION_URL || 'https://api.open-meteo.com/v1/elevation',
  );
  const apiKey = String(env.AETHERGRID_OPEN_METEO_API_KEY || '');

  function summary() {
    return {
      provider,
      configured: provider === 'open-meteo' ? true : provider === 'flat-local',
      endpoint: provider === 'open-meteo' ? safeUrl(endpoint, 'elevation URL').origin : null,
      resolutionMeters: provider === 'open-meteo' ? 90 : null,
      maxPointsPerRequest: provider === 'open-meteo' ? 100 : null,
      attribution:
        provider === 'open-meteo'
          ? 'Elevation: Open-Meteo using Copernicus DEM GLO-90'
          : null,
      credentialsExposed: false,
    };
  }

  async function sample(input = {}) {
    const request = validatePoint(input);
    if (provider !== 'open-meteo') return fallbackTerrain(request);

    const points = sampleGrid(request);
    const url = safeUrl(endpoint, 'elevation URL');
    url.searchParams.set(
      'latitude',
      points.map((point) => point.lat.toFixed(6)).join(','),
    );
    url.searchParams.set(
      'longitude',
      points.map((point) => point.lon.toFixed(6)).join(','),
    );
    if (apiKey) url.searchParams.set('apikey', apiKey);

    try {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.elevation)) {
        throw new Error(payload.reason || `Elevation HTTP ${response.status}`);
      }
      if (payload.elevation.length !== points.length) {
        throw new Error('Elevation response length did not match requested point count');
      }
      const elevations = payload.elevation.map(Number);
      if (elevations.some((value) => !Number.isFinite(value))) {
        throw new Error('Elevation response contained non-numeric values');
      }
      const minElevationM = Math.min(...elevations);
      const maxElevationM = Math.max(...elevations);
      return {
        schemaVersion: 1,
        source: {
          provider: 'Open-Meteo Elevation',
          live: true,
          attribution: 'Elevation: Open-Meteo using Copernicus DEM GLO-90',
        },
        center: { lat: request.lat, lon: request.lon },
        radiusM: request.radiusM,
        gridSize: request.gridSize,
        minElevationM,
        maxElevationM,
        points: points.map((point, index) => ({
          ...point,
          elevationM: elevations[index],
          relativeElevationM: elevations[index] - minElevationM,
        })),
      };
    } catch (error) {
      const fallback = fallbackTerrain(request);
      fallback.source.attribution = 'Live elevation unavailable for this request.';
      fallback.source.error = error instanceof Error ? error.message : String(error);
      return fallback;
    }
  }

  return { summary, sample };
}

(() => {
  'use strict';
  // Browser-local modeled fallback only: never promote this to live OSM observations.
function buildStandaloneCityMesh(city, count = 120) {
    let seed = [...String(city?.id || 'city')].reduce(
      (value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0,
      2166136261,
    );
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const buildings = Array.from({ length: count }, (_, index) => {
      const x = (random() - 0.5) * 1500;
      const z = (random() - 0.5) * 1500;
      const width = 10 + random() * 35;
      const depth = 10 + random() * 35;
      return {
        id: `standalone-${index + 1}`,
        name: '',
        heightM: 9 + random() * 110,
        heightSource: 'synthetic-fallback',
        minHeightM: 0,
        roofShape: '',
        roofHeightM: 0,
        footprint: [
          [x - width, z - depth],
          [x + width, z - depth],
          [x + width, z + depth],
          [x - width, z + depth],
          [x - width, z - depth],
        ],
      };
    });
    const roads = Array.from({ length: 18 }, (_, index) => {
      const horizontal = index % 2 === 0;
      const offset = (random() - 0.5) * 1250;
      const wobble = (random() - 0.5) * 80;
      return {
        id: `standalone-road-${index + 1}`,
        name: '',
        highwayType: index % 4 === 0 ? 'primary' : 'residential',
        path: horizontal
          ? [
              [-720, offset],
              [-250, offset + wobble],
              [250, offset - wobble],
              [720, offset],
            ]
          : [
              [offset, -720],
              [offset + wobble, -250],
              [offset - wobble, 250],
              [offset, 720],
            ],
      };
    });
    const powerAssets = Array.from({ length: 8 }, (_, index) => ({
      id: `standalone-power-asset-${index + 1}`,
      name: index % 3 === 0 ? `Fallback Substation ${index + 1}` : '',
      powerType: index % 3 === 0 ? 'substation' : 'transformer',
      voltage: index % 3 === 0 ? 138000 : 13800,
      operator: '',
      position: [(random() - 0.5) * 1200, (random() - 0.5) * 1200],
    }));
    const powerLines = Array.from({ length: 8 }, (_, index) => {
      const horizontal = index % 2 === 0;
      const offset = (random() - 0.5) * 1050;
      return {
        id: `standalone-power-line-${index + 1}`,
        name: '',
        powerType: index % 4 === 0 ? 'line' : 'minor_line',
        voltage: index % 4 === 0 ? 138000 : 33000,
        operator: '',
        path: horizontal
          ? [
              [-700, offset],
              [-180, offset + (random() - 0.5) * 70],
              [280, offset + (random() - 0.5) * 70],
              [700, offset],
            ]
          : [
              [offset, -700],
              [offset + (random() - 0.5) * 70, -180],
              [offset + (random() - 0.5) * 70, 280],
              [offset, 700],
            ],
      };
    });
    const terrainGridSize = 7;
    const terrainPoints = [];
    for (let row = 0; row < terrainGridSize; row += 1) {
      for (let column = 0; column < terrainGridSize; column += 1) {
        const x = -city.radiusM + (column / (terrainGridSize - 1)) * city.radiusM * 2;
        const z = -city.radiusM + (row / (terrainGridSize - 1)) * city.radiusM * 2;
        terrainPoints.push({
          x,
          z,
          elevationM: 0,
          relativeElevationM: 0,
        });
      }
    }
    const fallbackHeights = buildings.map((building) => Number(building.heightM || 0)).sort((a, b) => a - b);
    const fallbackPercentile = (amount) =>
      fallbackHeights[Math.min(fallbackHeights.length - 1, Math.floor((fallbackHeights.length - 1) * amount))] || 0;
    return {
      schemaVersion: 4,
      city,
      source: {
        provider: 'standalone-local-fallback',
        live: false,
        attribution: 'Live OpenStreetMap geometry requires the Node backend.',
      },
      buildings,
      skylineProfile: {
        district: city.district || null,
        buildingCount: buildings.length,
        maxHeightM: Number(Math.max(...fallbackHeights).toFixed(1)),
        p95HeightM: Number(fallbackPercentile(0.95).toFixed(1)),
        medianHeightM: Number(fallbackPercentile(0.5).toFixed(1)),
        sourceBackedHeightCoveragePercent: 0,
        buildingPartCount: 0,
        roofTaggedCount: 0,
        upstreamTimestamp: null,
        sourceProvider: 'standalone-local-fallback',
        live: false,
      },
      environment: {
        schemaVersion: 2,
        coordinate: { lat: city.lat, lon: city.lon },
        source: { provider: 'local-environment-fallback', live: false, attribution: null, fetchedAt: new Date().toISOString() },
        current: null,
        solar: null,
      },
      liveContext: {
        schemaVersion: 1,
        coordinate: { lat: city.lat, lon: city.lon },
        airQuality: { source: { provider: 'local-air-quality-fallback', live: false, attribution: null }, current: null },
        seismic: { source: { provider: 'local-seismic-fallback', live: false, attribution: null }, radiusKm: 1200, events: [], eventCount: 0, maxMagnitude: null, nearestDistanceKm: null },
      },
      roads,
      powerLines,
      powerAssets,
      waterAreas: [],
      waterways: [],
      coastlines: [],
      greenAreas: [],
      terrain: {
        source: {
          provider: 'flat-local-fallback',
          live: false,
          attribution: null,
        },
        gridSize: terrainGridSize,
        minElevationM: 0,
        maxElevationM: 0,
        points: terrainPoints,
      },
    };
  }


  globalThis.AETHERGRID_STANDALONE_GEO = Object.freeze({ buildStandaloneCityMesh });
})();

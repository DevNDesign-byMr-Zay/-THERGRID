function planarLength(path = []) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    if (!a || !b) continue;
    total += Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
  }
  return total;
}

function polygonArea(path = []) {
  if (path.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < path.length; index += 1) {
    const a = path[index];
    const b = path[(index + 1) % path.length];
    area += Number(a?.[0] || 0) * Number(b?.[1] || 0) - Number(b?.[0] || 0) * Number(a?.[1] || 0);
  }
  return Math.abs(area) / 2;
}

export function clampIndex(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function cityMeshMetrics(mesh) {
  const buildings = Array.isArray(mesh?.buildings) ? mesh.buildings : [];
  const roads = Array.isArray(mesh?.roads) ? mesh.roads : [];
  const powerLines = Array.isArray(mesh?.powerLines) ? mesh.powerLines : [];
  const powerAssets = Array.isArray(mesh?.powerAssets) ? mesh.powerAssets : [];
  const waterAreas = Array.isArray(mesh?.waterAreas) ? mesh.waterAreas : [];
  const waterways = Array.isArray(mesh?.waterways) ? mesh.waterways : [];
  const coastlines = Array.isArray(mesh?.coastlines) ? mesh.coastlines : [];
  const greenAreas = Array.isArray(mesh?.greenAreas) ? mesh.greenAreas : [];
  const radiusM = Math.max(250, Number(mesh?.city?.radiusM || 900));
  let footprintAreaM2 = 0;
  let estimatedFloorAreaM2 = 0;
  let heightTotalM = 0;
  for (const building of buildings) {
    const area = polygonArea(building.footprint || []);
    const minHeight = Math.max(0, Number(building.minHeightM || 0));
    const height = Math.max(minHeight + 3.2, Number(building.heightM || 12));
    const levels = Math.max(1, Number(building.levels) || Math.round((height - minHeight) / 3.2));
    footprintAreaM2 += area;
    estimatedFloorAreaM2 += area * levels;
    heightTotalM += height;
  }
  const roadLengthKm = roads.reduce((sum, road) => sum + planarLength(road.path || []), 0) / 1000;
  const primaryRoadKm = roads
    .filter((road) => /^(motorway|trunk|primary|secondary)$/u.test(String(road.highwayType || '')))
    .reduce((sum, road) => sum + planarLength(road.path || []), 0) / 1000;
  const powerLineKm = powerLines.reduce((sum, line) => sum + planarLength(line.path || []), 0) / 1000;
  const highVoltageKm = powerLines
    .filter((line) => Number(line.voltage || 0) >= 100000)
    .reduce((sum, line) => sum + planarLength(line.path || []), 0) / 1000;
  const substations = powerAssets.filter((asset) => asset.powerType === 'substation').length;
  const generationAssets = powerAssets.filter((asset) => ['plant', 'generator'].includes(asset.powerType)).length;
  const waterAreaM2 = waterAreas.reduce(
    (sum, feature) => sum + polygonArea(feature.footprint || []),
    0,
  );
  const waterwayLengthKm =
    [...waterways, ...coastlines].reduce(
      (sum, feature) => sum + planarLength(feature.path || []),
      0,
    ) / 1000;
  const greenAreaM2 = greenAreas.reduce(
    (sum, feature) => sum + polygonArea(feature.footprint || []),
    0,
  );
  const sourceHeightValues = buildings
    .filter(
      (building) =>
        !['inferred', 'synthetic-fallback'].includes(String(building.heightSource || '')) &&
        Number(building.heightM || 0) > 0,
    )
    .map((building) => Number(building.heightM));
  const landmarkThresholdM = sourceHeightValues.length
    ? Math.max(
        70,
        [...sourceHeightValues].sort((a, b) => a - b)[
          Math.floor((sourceHeightValues.length - 1) * 0.95)
        ],
      )
    : 70;
  const namedLandmarkCount = buildings.filter(
    (building) =>
      String(building.name || '').trim() &&
      !['inferred', 'synthetic-fallback'].includes(String(building.heightSource || '')) &&
      Number(building.heightM || 0) >= landmarkThresholdM,
  ).length;
  const terrainReliefM = Math.max(0, Number(mesh?.terrain?.maxElevationM || 0) - Number(mesh?.terrain?.minElevationM || 0));
  const sampledAreaKm2 = Math.PI * Math.pow(radiusM / 1000, 2);
  return {
    buildingCount: buildings.length,
    footprintAreaM2: Math.round(footprintAreaM2),
    estimatedFloorAreaM2: Math.round(estimatedFloorAreaM2),
    averageBuildingHeightM: buildings.length ? Number((heightTotalM / buildings.length).toFixed(1)) : 0,
    roadLengthKm: Number(roadLengthKm.toFixed(2)),
    primaryRoadKm: Number(primaryRoadKm.toFixed(2)),
    powerLineKm: Number(powerLineKm.toFixed(2)),
    highVoltageKm: Number(highVoltageKm.toFixed(2)),
    powerAssetCount: powerAssets.length,
    substations,
    generationAssets,
    waterAreaM2: Math.round(waterAreaM2),
    waterwayLengthKm: Number(waterwayLengthKm.toFixed(2)),
    waterFeatureCount: waterAreas.length + waterways.length + coastlines.length,
    greenAreaM2: Math.round(greenAreaM2),
    greenFeatureCount: greenAreas.length,
    namedLandmarkCount,
    terrainReliefM: Number(terrainReliefM.toFixed(1)),
    sampledAreaKm2: Number(sampledAreaKm2.toFixed(2)),
  };
}

export function liveCitySignals(mesh) {
  const environment = mesh?.environment?.current || {};
  const air = mesh?.liveContext?.airQuality?.current || {};
  const seismic = Array.isArray(mesh?.liveContext?.seismic?.events)
    ? mesh.liveContext.seismic.events
    : [];
  const maxSeismicMagnitude = seismic.length
    ? Math.max(...seismic.map((event) => Number(event.magnitude || 0)))
    : 0;
  const nearestSeismicKm = seismic.length
    ? Math.min(...seismic.map((event) => Number(event.distanceKm || Infinity)))
    : null;
  return {
    temperatureC: Number.isFinite(Number(environment.temperatureC))
      ? Number(environment.temperatureC)
      : null,
    apparentTemperatureC: Number.isFinite(Number(environment.apparentTemperatureC))
      ? Number(environment.apparentTemperatureC)
      : null,
    relativeHumidityPercent: Number.isFinite(Number(environment.relativeHumidityPercent))
      ? Number(environment.relativeHumidityPercent)
      : null,
    surfacePressureHpa: Number.isFinite(Number(environment.surfacePressureHpa))
      ? Number(environment.surfacePressureHpa)
      : null,
    isDay: typeof environment.isDay === 'boolean' ? environment.isDay : null,
    sunrise: mesh?.environment?.solar?.sunrise || null,
    sunset: mesh?.environment?.solar?.sunset || null,
    daylightDurationSeconds: Number.isFinite(
      Number(mesh?.environment?.solar?.daylightDurationSeconds),
    )
      ? Number(mesh.environment.solar.daylightDurationSeconds)
      : null,
    cloudCoverPercent: Number.isFinite(Number(environment.cloudCoverPercent))
      ? Number(environment.cloudCoverPercent)
      : null,
    precipitationMm: Number.isFinite(Number(environment.precipitationMm))
      ? Number(environment.precipitationMm)
      : 0,
    windSpeedKph: Number.isFinite(Number(environment.windSpeedKph))
      ? Number(environment.windSpeedKph)
      : 0,
    windGustsKph: Number.isFinite(Number(environment.windGustsKph))
      ? Number(environment.windGustsKph)
      : 0,
    shortwaveRadiationWm2: Number.isFinite(Number(environment.shortwaveRadiationWm2))
      ? Number(environment.shortwaveRadiationWm2)
      : null,
    visibilityM: Number.isFinite(Number(environment.visibilityM))
      ? Number(environment.visibilityM)
      : null,
    usAqi: Number.isFinite(Number(air.usAqi)) ? Number(air.usAqi) : null,
    airCategory: air.category || 'unknown',
    pm25UgM3: Number.isFinite(Number(air.pm25UgM3)) ? Number(air.pm25UgM3) : null,
    pm10UgM3: Number.isFinite(Number(air.pm10UgM3)) ? Number(air.pm10UgM3) : null,
    uvIndex: Number.isFinite(Number(air.uvIndex)) ? Number(air.uvIndex) : null,
    seismicEventCount: seismic.length,
    maxSeismicMagnitude,
    nearestSeismicKm: Number.isFinite(nearestSeismicKm) ? Number(nearestSeismicKm.toFixed(1)) : null,
  };
}

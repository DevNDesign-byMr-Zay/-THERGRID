import { CITY_USE_CASES } from './city-use-cases.mjs';
import { cityMeshMetrics, liveCitySignals, clampIndex } from './city-metrics.mjs';

export function analyzeCityUseCase(mesh, useCaseId) {
  const useCase = CITY_USE_CASES[useCaseId];
  if (!useCase) {
    const error = new Error(`unsupported city use case: ${useCaseId}`);
    error.status = 400;
    throw error;
  }
  if (!mesh?.city) {
    const error = new Error('city mesh required before running a city operation');
    error.status = 409;
    throw error;
  }
  const metrics = cityMeshMetrics(mesh);
  const liveSignals = liveCitySignals(mesh);
  const densityRatio =
    metrics.sampledAreaKm2 > 0
      ? metrics.footprintAreaM2 / (metrics.sampledAreaKm2 * 1_000_000)
      : 0;
  const builtMass = clampIndex(densityRatio * 420 + metrics.averageBuildingHeightM * 0.55);
  const roadCoverage = clampIndex(metrics.roadLengthKm * 4 + metrics.primaryRoadKm * 7);
  const gridCoverage = clampIndex(
    metrics.powerLineKm * 7 + metrics.powerAssetCount * 5 + metrics.substations * 8,
  );
  const terrainComplexity = clampIndex(metrics.terrainReliefM * 1.4);
  const weatherStress = clampIndex(
    liveSignals.windSpeedKph * 0.6 +
      liveSignals.windGustsKph * 0.8 +
      liveSignals.precipitationMm * 14,
  );
  const airStress = clampIndex(liveSignals.usAqi ?? 0);
  const seismicStress = clampIndex(
    liveSignals.maxSeismicMagnitude * 12 +
      (liveSignals.nearestSeismicKm == null
        ? 0
        : Math.max(0, 800 - liveSignals.nearestSeismicKm) / 12),
  );
  const solarSignal = clampIndex(
    (liveSignals.shortwaveRadiationWm2 || 0) / 10 +
      (100 - (liveSignals.cloudCoverPercent ?? 50)) * 0.25,
  );
  const apparentHeatStress = clampIndex(
    Math.max(0, Number(liveSignals.apparentTemperatureC ?? liveSignals.temperatureC ?? 20) - 20) * 4,
  );
  const humidityStress = clampIndex(liveSignals.relativeHumidityPercent ?? 0);
  const uvStress = clampIndex((liveSignals.uvIndex ?? 0) * 10);
  const visibilityStress =
    liveSignals.visibilityM == null
      ? 0
      : clampIndex(Math.max(0, 20_000 - liveSignals.visibilityM) / 200);
  const sampledAreaM2 = Math.max(1, metrics.sampledAreaKm2 * 1_000_000);
  const waterCoverage = clampIndex((metrics.waterAreaM2 / sampledAreaM2) * 500);
  const waterEdgeContext = clampIndex(metrics.waterwayLengthKm * 7);
  const greenCoverage = clampIndex((metrics.greenAreaM2 / sampledAreaM2) * 650);
  const heatPressure = clampIndex(
    apparentHeatStress * 0.5 + humidityStress * 0.2 + uvStress * 0.12 + builtMass * 0.18,
  );

  let planningIndex = 0;
  let observations = [];
  if (useCaseId === 'grid-resilience') {
    planningIndex = clampIndex(
      gridCoverage * 0.55 +
        roadCoverage * 0.12 +
        (100 - terrainComplexity) * 0.08 +
        weatherStress * 0.17 +
        seismicStress * 0.08,
    );
    observations = [
      `${metrics.powerLineKm.toFixed(1)} km of mapped power lines, ${metrics.powerAssetCount} mapped power assets and ${metrics.substations} substations are visible in the bounded sample.`,
      `Current model context: wind ${liveSignals.windSpeedKph.toFixed(1)} km/h, gusts ${liveSignals.windGustsKph.toFixed(1)} km/h and precipitation ${liveSignals.precipitationMm.toFixed(1)} mm.`,
      `${liveSignals.seismicEventCount} USGS M2.5+ event(s) are within the live seismic radius; this is context for review, not a failure prediction.`,
    ];
  } else if (useCaseId === 'outage-impact') {
    planningIndex = clampIndex(
      builtMass * 0.45 + gridCoverage * 0.35 + weatherStress * 0.15 + seismicStress * 0.05,
    );
    observations = [
      `${metrics.buildingCount} mapped buildings represent approximately ${Math.round(metrics.estimatedFloorAreaM2).toLocaleString()} m² of estimated floor area.`,
      `${metrics.powerAssetCount} mapped power assets overlap the same bounded city sample; current weather attention is ${weatherStress}/100.`,
      'The index is an exposure-planning proxy only; it does not assert customers affected, component failure or outage probability.',
    ];
  } else if (useCaseId === 'emergency-access') {
    planningIndex = clampIndex(
      roadCoverage * 0.62 +
        (100 - terrainComplexity) * 0.18 +
        (100 - weatherStress) * 0.2,
    );
    observations = [
      `${metrics.roadLengthKm.toFixed(1)} km of mapped road centerlines are available, including ${metrics.primaryRoadKm.toFixed(1)} km of major roads.`,
      `Current precipitation is ${liveSignals.precipitationMm.toFixed(1)} mm and gusts are ${liveSignals.windGustsKph.toFixed(1)} km/h; mapped terrain relief is ${metrics.terrainReliefM.toFixed(0)} m.`,
      'Road presence and modeled weather are not live traffic, closure, routing or emergency-response guarantees.',
    ];
  } else if (useCaseId === 'renewable-siting') {
    planningIndex = clampIndex(
      (100 - builtMass) * 0.2 +
        gridCoverage * 0.35 +
        (100 - terrainComplexity) * 0.15 +
        solarSignal * 0.2 +
        clampIndex(liveSignals.windSpeedKph * 3) * 0.1,
    );
    observations = [
      `${metrics.generationAssets} mapped generation assets and ${metrics.powerLineKm.toFixed(1)} km of mapped power lines provide grid-context anchors.`,
      `Current model resource snapshot: ${liveSignals.shortwaveRadiationWm2 == null ? 'solar radiation unavailable' : `${liveSignals.shortwaveRadiationWm2.toFixed(0)} W/m² shortwave radiation`}, ${liveSignals.cloudCoverPercent == null ? 'cloud unavailable' : `${liveSignals.cloudCoverPercent.toFixed(0)}% cloud`} and ${liveSignals.windSpeedKph.toFixed(1)} km/h wind.`,
      'A current weather snapshot does not replace long-term resource assessment, ownership, permitting, interconnection or environmental studies.',
    ];
  } else if (useCaseId === 'load-growth') {
    planningIndex = clampIndex(builtMass * 0.64 + roadCoverage * 0.16 + gridCoverage * 0.2);
    observations = [
      `${metrics.buildingCount} mapped buildings average ${metrics.averageBuildingHeightM.toFixed(1)} m in modeled height.`,
      `Estimated mapped floor area is ${Math.round(metrics.estimatedFloorAreaM2).toLocaleString()} m² inside the bounded sample.`,
      'This is a built-form planning proxy, not a utility load forecast or customer-demand measurement.',
    ];
  } else if (useCaseId === 'weather-readiness') {
    planningIndex = weatherStress;
    observations = [
      `Current weather model: wind ${liveSignals.windSpeedKph.toFixed(1)} km/h, gusts ${liveSignals.windGustsKph.toFixed(1)} km/h and precipitation ${liveSignals.precipitationMm.toFixed(1)} mm.`,
      `Cloud cover is ${liveSignals.cloudCoverPercent == null ? 'unavailable' : `${liveSignals.cloudCoverPercent.toFixed(0)}%`} and visibility is ${liveSignals.visibilityM == null ? 'unavailable' : `${(liveSignals.visibilityM / 1000).toFixed(1)} km`}.`,
      'The animated weather field represents current model conditions at the city coordinate, not street-level instrumentation.',
    ];
  } else if (useCaseId === 'air-quality-exposure') {
    planningIndex = clampIndex(airStress * 0.7 + builtMass * 0.3);
    observations = [
      `Current modeled US AQI is ${liveSignals.usAqi == null ? 'unavailable' : liveSignals.usAqi.toFixed(0)} (${liveSignals.airCategory}).`,
      `PM2.5 is ${liveSignals.pm25UgM3 == null ? 'unavailable' : `${liveSignals.pm25UgM3.toFixed(1)} µg/m³`} and PM10 is ${liveSignals.pm10UgM3 == null ? 'unavailable' : `${liveSignals.pm10UgM3.toFixed(1)} µg/m³`}.`,
      `The atmospheric overlay is paired with ${metrics.buildingCount} mapped buildings and ${metrics.roadLengthKm.toFixed(1)} km of road geometry; it is not a block-level exposure measurement.`,
    ];
  } else if (useCaseId === 'heat-stress') {
    planningIndex = clampIndex(
      apparentHeatStress * 0.45 + humidityStress * 0.2 + uvStress * 0.15 + builtMass * 0.2,
    );
    observations = [
      `Current modeled temperature is ${liveSignals.temperatureC == null ? 'unavailable' : `${liveSignals.temperatureC.toFixed(1)}°C`} with apparent temperature ${liveSignals.apparentTemperatureC == null ? 'unavailable' : `${liveSignals.apparentTemperatureC.toFixed(1)}°C`}.`,
      `Relative humidity is ${liveSignals.relativeHumidityPercent == null ? 'unavailable' : `${liveSignals.relativeHumidityPercent.toFixed(0)}%`} and UV index is ${liveSignals.uvIndex == null ? 'unavailable' : liveSignals.uvIndex.toFixed(1)}.`,
      `Mapped built-form density contributes context from ${metrics.buildingCount} structures; this is an urban heat attention proxy, not WBGT, a clinical heat-risk assessment or a block-level temperature sensor.`,
    ];
  } else if (useCaseId === 'visibility-operations') {
    planningIndex = clampIndex(
      visibilityStress * 0.48 +
        weatherStress * 0.22 +
        airStress * 0.18 +
        clampIndex(metrics.roadLengthKm * 3) * 0.12,
    );
    observations = [
      `Current modeled visibility is ${liveSignals.visibilityM == null ? 'unavailable' : `${(liveSignals.visibilityM / 1000).toFixed(1)} km`}; cloud cover is ${liveSignals.cloudCoverPercent == null ? 'unavailable' : `${liveSignals.cloudCoverPercent.toFixed(0)}%`}.`,
      `Precipitation is ${liveSignals.precipitationMm.toFixed(1)} mm and modeled US AQI is ${liveSignals.usAqi == null ? 'unavailable' : liveSignals.usAqi.toFixed(0)}.`,
      `The scene pairs atmospheric context with ${metrics.roadLengthKm.toFixed(1)} km of mapped roads; it is not a navigation clearance, aviation minimum or live traffic visibility guarantee.`,
    ];
  } else if (useCaseId === 'flood-context') {
    planningIndex = clampIndex(
      waterCoverage * 0.3 +
        waterEdgeContext * 0.18 +
        clampIndex(liveSignals.precipitationMm * 18) * 0.22 +
        builtMass * 0.12 +
        terrainComplexity * 0.08 +
        gridCoverage * 0.1,
    );
    observations = [
      `${metrics.waterFeatureCount} mapped water/coastline feature(s) contribute ${Math.round(metrics.waterAreaM2).toLocaleString()} m² of mapped water area and ${metrics.waterwayLengthKm.toFixed(1)} km of mapped waterway/coastline geometry in the bounded sample.`,
      `Current modeled precipitation is ${liveSignals.precipitationMm.toFixed(1)} mm; mapped terrain relief is ${metrics.terrainReliefM.toFixed(0)} m and ${metrics.roadLengthKm.toFixed(1)} km of road geometry is visible for spatial review.`,
      'This is a mapped-context attention proxy only. It does not model drainage capacity, storm surge, river stage, surface runoff, inundation depth or forecast flooding.',
    ];
  } else if (useCaseId === 'green-infrastructure') {
    planningIndex = clampIndex(
      heatPressure * 0.42 +
        builtMass * 0.28 +
        (100 - greenCoverage) * 0.2 +
        airStress * 0.1,
    );
    observations = [
      `${metrics.greenFeatureCount} mapped green feature(s) contribute approximately ${Math.round(metrics.greenAreaM2).toLocaleString()} m² of green-area geometry in the bounded sample.`,
      `Current heat context includes apparent temperature ${liveSignals.apparentTemperatureC == null ? 'unavailable' : `${liveSignals.apparentTemperatureC.toFixed(1)}°C`}, humidity ${liveSignals.relativeHumidityPercent == null ? 'unavailable' : `${liveSignals.relativeHumidityPercent.toFixed(0)}%`} and US AQI ${liveSignals.usAqi == null ? 'unavailable' : liveSignals.usAqi.toFixed(0)}.`,
      'The result is a screening proxy for where mapped green-space context may deserve closer planning review; it is not canopy coverage, heat-island measurement, public-health exposure or a siting directive.',
    ];
  } else {
    planningIndex = clampIndex(seismicStress * 0.72 + builtMass * 0.18 + terrainComplexity * 0.1);
    observations = [
      `${liveSignals.seismicEventCount} USGS M2.5+ event(s) are inside the configured live radius around ${mesh.city.name}.`,
      `Maximum listed magnitude is ${liveSignals.maxSeismicMagnitude.toFixed(1)}${liveSignals.nearestSeismicKm == null ? '' : ` and the nearest listed event is ${liveSignals.nearestSeismicKm.toFixed(0)} km away`}.`,
      'USGS event pulses provide situational context only; they are not a structural-damage estimate, aftershock forecast or emergency directive.',
    ];
  }

  return {
    schemaVersion: 4,
    useCase,
    city: mesh.city,
    generatedAt: new Date().toISOString(),
    planningIndex: {
      label: useCase.indexLabel,
      value: planningIndex,
      scale: '0-100 bounded planning/context proxy',
    },
    metrics,
    liveSignals,
    observations,
    visualization: {
      animationProfile: useCase.animationProfile,
      recommendedLayers: useCase.recommendedLayers,
      sourceDriven: true,
    },
    dataQuality: {
      geometryProvider: mesh.source?.provider || 'unknown',
      liveGeometry: Boolean(mesh.source?.live),
      terrainProvider: mesh.terrain?.source?.provider || null,
      liveTerrain: Boolean(mesh.terrain?.source?.live),
      weatherProvider: mesh.environment?.source?.provider || null,
      liveWeather: Boolean(mesh.environment?.source?.live),
      airQualityProvider: mesh.liveContext?.airQuality?.source?.provider || null,
      liveAirQuality: Boolean(mesh.liveContext?.airQuality?.source?.live),
      seismicProvider: mesh.liveContext?.seismic?.source?.provider || null,
      liveSeismic: Boolean(mesh.liveContext?.seismic?.source?.live),
      mappedWaterFeatures: metrics.waterFeatureCount,
      mappedGreenFeatures: metrics.greenFeatureCount,
      mappedNamedLandmarks: metrics.namedLandmarkCount,
      limitations:
        'Decision-support indicators combine the currently loaded bounded map sample with current model/feed context and are not operational ground truth.',
    },
    advisoryOnly: true,
  };
}

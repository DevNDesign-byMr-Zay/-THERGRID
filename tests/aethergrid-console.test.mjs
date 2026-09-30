import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CITY_USE_CASES,
  analyzeCityUseCase,
  cityMeshMetrics,
  server,
  spatialGraph,
  state,
} from '../apps/aethergrid-console/server.mjs';

async function withServer(run) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('ÆTHERGRID serves semantic dashboard elements instead of a screenshot-backed shell', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<canvas id="spatialGrid"/u);
    assert.match(html, /data-workspace-target="holographic"/u);
    assert.match(html, /data-workspace="grid"/u);
    assert.match(html, /data-workspace="global"/u);
    assert.match(html, /id="globalGlobe"/u);
    assert.match(html, /id="cityGrid"/u);
    assert.match(html, /data-action="load-live-city"/u);
    assert.match(html, /data-action="explore-coordinates"/u);
    assert.match(html, /id="globalPointLat"/u);
    assert.match(html, /id="globalPointLon"/u);
    assert.match(html, /id="globalTimeSlider"/u);
    assert.match(html, /data-action="city-live-now"/u);
    assert.match(html, /data-global-layer="infrastructure"/u);
    assert.match(html, /data-global-layer="terrain"/u);
    assert.match(html, /data-global-layer="water"/u);
    assert.match(html, /data-global-layer="green"/u);
    assert.match(html, /data-global-layer="landmarks"/u);
    assert.match(html, /data-global-layer="weather"/u);
    assert.match(html, /data-global-layer="clouds"/u);
    assert.match(html, /data-global-layer="illumination"/u);
    assert.match(html, /data-global-layer="air"/u);
    assert.match(html, /data-global-layer="seismic"/u);
    assert.match(html, /id="globalLiveStatus"/u);
    assert.match(html, /id="globalSolarStatus"/u);
    assert.match(html, /value="weather-readiness"/u);
    assert.match(html, /value="air-quality-exposure"/u);
    assert.match(html, /value="seismic-awareness"/u);
    assert.match(html, /value="heat-stress"/u);
    assert.match(html, /value="visibility-operations"/u);
    assert.match(html, /value="flood-context"/u);
    assert.match(html, /value="green-infrastructure"/u);
    assert.match(html, /id="globalGridStats"/u);
    assert.match(html, /id="cityTransitionOverlay"/u);
    assert.match(html, /data-city-visual="solid"/u);
    assert.match(html, /id="cityUseCaseSelect"/u);
    assert.match(html, /data-action="run-city-use-case"/u);
    assert.match(html, /id="agentThreadBadge"/u);
    assert.match(html, /data-workspace="holographic"/u);
    assert.match(html, /data-workspace="quantum"/u);
    assert.match(html, /data-workspace="ai"/u);
    assert.match(html, /data-workspace="scenarios"/u);
    assert.match(html, /data-workspace="evidence"/u);
    assert.match(html, /data-workspace="settings"/u);
    assert.match(html, /data-view="forecast"/u);
    assert.match(html, /id="timeSlider"/u);
    assert.match(html, /data-map-tool="buildings"/u);
    assert.match(html, /data-agent="TEAM"/u);
    assert.match(html, /data-agent="VÆLON"/u);
    assert.match(html, /id="quantumCanvas"/u);
    assert.match(html, /id="scenarioChart"/u);
    assert.match(html, /id="settingTheme"/u);
    assert.match(html, /id="settingDefaultWorkspace"/u);
    assert.match(html, /id="settingLiveStream"/u);
    assert.match(html, /id="profileForm"/u);
    assert.match(html, /id="profileAvatarInput"/u);
    assert.match(html, /id="quantumPrimitive"/u);
    assert.match(html, /id="quantumObservable"/u);
    assert.match(html, /id="quantumCircuit"/u);
    assert.match(html, /data-action="submit-quantum-job"/u);
    assert.match(html, /data-scenario="custom"/u);
    assert.match(html, /id="customLoad"/u);
    assert.match(html, /data-action="apply-custom-scenario"/u);
    assert.match(html, /data-action="duplicate-scenario"/u);
    assert.match(html, /id="auditTimeline"/u);
    assert.match(html, /id="holoCompareEnabled"/u);
    assert.match(html, /href="\.\/styles\.css"/u);
    assert.match(html, /src="\.\/app\.js"/u);
    assert.doesNotMatch(html, /dashboard-reference/iu);
    assert.doesNotMatch(html, /class="dashboard-reference"/u);

    const appResponse = await fetch(`${baseUrl}/app.js`);
    assert.equal(appResponse.status, 200);
    const appSource = await appResponse.text();
    assert.match(appSource, /class SpatialGrid4D/u);
    assert.match(appSource, /class GlobalGlobe3D/u);
    assert.match(appSource, /loadCityMesh\(mesh\)/u);
    assert.match(appSource, /attribute vec4 a_position/u);
    assert.match(appSource, /gl\.drawArrays/u);
    assert.match(appSource, /pointerdown/u);
    assert.match(appSource, /wheel/u);
    assert.match(appSource, /function switchWorkspace/u);
    assert.match(appSource, /localStorage\.setItem\(SETTINGS_KEY/u);
    assert.match(appSource, /pickNode\(clientX, clientY\)/u);
    assert.match(appSource, /projectNode\(node\)/u);
    assert.match(appSource, /activateScenario\(name, parameters/u);
    assert.match(appSource, /scenarioTemplateParameters/u);
    assert.match(appSource, /function renderActivity/u);
    assert.match(appSource, /setCompare\(enabled, hours/u);
    assert.match(appSource, /function renderSavedViews/u);
    assert.match(appSource, /async function loadLiveCity/u);
    assert.match(appSource, /async function loadCoordinateCity/u);
    assert.match(appSource, /infrastructureLines/u);
    assert.match(appSource, /terrainLines/u);
    assert.match(appSource, /waterLines/u);
    assert.match(appSource, /waterFaces/u);
    assert.match(appSource, /greenLines/u);
    assert.match(appSource, /greenFaces/u);
    assert.match(appSource, /landmarkLines/u);
    assert.match(appSource, /materialGlassFaces/u);
    assert.match(appSource, /materialMasonryFaces/u);
    assert.match(appSource, /materialMetalFaces/u);
    assert.match(appSource, /materialNaturalFaces/u);
    assert.match(appSource, /loadTerrainFor/u);
    assert.match(appSource, /powerAssets/u);
    assert.match(appSource, /buildingFaces/u);
    assert.match(appSource, /roofFaces/u);
    assert.match(appSource, /roofLines/u);
    assert.match(appSource, /weatherLines/u);
    assert.match(appSource, /precipitationLines/u);
    assert.match(appSource, /airParticles/u);
    assert.match(appSource, /seismicLines/u);
    assert.match(appSource, /cloudParticles/u);
    assert.match(appSource, /cityLights/u);
    assert.match(appSource, /u_flow/u);
    assert.match(appSource, /u_drop/u);
    assert.match(appSource, /setLiveActivity/u);
    assert.match(appSource, /solarPosition/u);
    assert.match(appSource, /updateSolarGeometry/u);
    assert.match(appSource, /updateUtcSweep/u);
    assert.match(appSource, /setOperationProfile/u);
    assert.match(appSource, /environmentHour/u);
    assert.match(appSource, /resolvedTheme/u);
    assert.match(appSource, /cityCameraTarget/u);
    assert.match(appSource, /gl\.TRIANGLES/u);
    assert.match(appSource, /cinematicEntrance/u);
    assert.match(appSource, /async function runCityUseCase/u);
    assert.match(appSource, /AGENT_CHAT_STORAGE_KEY/u);
    assert.match(appSource, /agentHistory\(name\)/u);
    assert.match(appSource, /syncQuantumPrimitiveControls/u);
    assert.match(appSource, /async function submitQuantumJob/u);
    assert.match(appSource, /async function saveProfile/u);
    assert.match(appSource, /data-workspace/u);

    const logo = await fetch(`${baseUrl}/assets/brand/aethergrid-logo.webp`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get('content-type'), /^image\/webp/u);
  });
});

test('ÆTHERGRID backend exposes bounded state and evidence APIs', async () => {
  await withServer(async (baseUrl) => {
    const stateResponse = await fetch(`${baseUrl}/api/aethergrid/state`);
    assert.equal(stateResponse.status, 200);
    const payload = await stateResponse.json();
    assert.equal(payload.system.mode, 'ADVISORY ONLY');
    assert.equal(payload.system.physicalActuation, false);
    assert.equal(payload.system.infrastructureDispatch, false);
    assert.equal(payload.system.view, 'live');
    assert.equal(payload.system.scenario, 'peak-demand');
    assert.ok(payload.regions.includes('New York Metro'));
    assert.ok(payload.scenarios.includes('renewable-surge'));
    assert.ok(payload.views.includes('forecast'));
    assert.deepEqual(Object.keys(payload.agents), ['VÆLON', 'AUREN', 'SOLVÆR']);

    const evidenceResponse = await fetch(`${baseUrl}/api/aethergrid/evidence`);
    assert.equal(evidenceResponse.status, 200);
    const evidence = await evidenceResponse.json();
    assert.ok(evidence.evidence.length >= 4);
    assert.ok(evidence.evidence.every((item) => item.status === 'VERIFIED'));
  });
});

test('ÆTHERGRID exposes replaceable agent runtime without leaking provider secrets', async () => {
  await withServer(async (baseUrl) => {
    const runtimeResponse = await fetch(`${baseUrl}/api/aethergrid/runtime`);
    assert.equal(runtimeResponse.status, 200);
    const runtime = await runtimeResponse.json();
    assert.equal(runtime.mode, 'replaceable-provider-runtime');
    assert.deepEqual(runtime.supportedProviders, ['local', 'openai-compatible', 'ollama']);
    assert.deepEqual(Object.keys(runtime.agents), ['VÆLON', 'AUREN', 'SOLVÆR', 'TEAM']);
    assert.equal(runtime.agents['VÆLON'].provider, 'local');
    assert.equal(runtime.agents['VÆLON'].status, 'local-fallback');
    assert.equal(runtime.geospatial.provider, 'osm-overpass');
    assert.equal(runtime.environment.provider, 'open-meteo');
    assert.equal(runtime.environment.credentialsExposed, false);
    assert.equal(runtime.liveContext.airQualityProvider, 'open-meteo');
    assert.equal(runtime.liveContext.seismicProvider, 'usgs');
    assert.equal(runtime.liveContext.credentialsExposed, false);
    assert.equal(runtime.terrain.provider, 'open-meteo');
    assert.equal(runtime.terrain.credentialsExposed, false);
    assert.equal(runtime.quantum.provider, 'local-simulator');
    assert.equal(runtime.quantum.credentialsExposed, false);
    assert.equal(runtime.profile.persistence, 'local-json');
    const serialized = JSON.stringify(runtime);
    assert.doesNotMatch(serialized, /API_KEY/iu);
    assert.doesNotMatch(serialized, /Bearer /u);

    const agentResponse = await fetch(`${baseUrl}/api/aethergrid/agents/${encodeURIComponent('AUREN')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Inspect spatial resilience risk.' }),
    });
    assert.equal(agentResponse.status, 200);
    const agent = await agentResponse.json();
    assert.match(agent.reply, /AUREN/u);
    assert.equal(agent.runtime.agent, 'AUREN');
    assert.equal(agent.runtime.provider, 'local');
    assert.equal(agent.advisoryOnly, true);
    assert.match(agent.receipt, /^[a-f0-9]{64}$/u);

    const teamResponse = await fetch(`${baseUrl}/api/aethergrid/team`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Evaluate renewable load reduction.' }),
    });
    assert.equal(teamResponse.status, 200);
    const team = await teamResponse.json();
    assert.equal(team.contributions.length, 3);
    assert.deepEqual(team.contributions.map((item) => item.agent), ['VÆLON', 'AUREN', 'SOLVÆR']);
    assert.equal(team.runtime.agent, 'TEAM');
    assert.equal(team.advisoryOnly, true);
    assert.match(team.receipt, /^[a-f0-9]{64}$/u);
    assert.equal(team.evidence.type, 'AI_TEAM');
    assert.equal(team.evidence.details.contributionReceipts.length, 3);

    const evidenceDetail = await fetch(
      `${baseUrl}/api/aethergrid/evidence/${encodeURIComponent(team.evidence.id)}`,
    );
    assert.equal(evidenceDetail.status, 200);
    const detailPayload = await evidenceDetail.json();
    assert.equal(detailPayload.evidence.receipt, team.receipt);
    assert.equal(detailPayload.evidence.details.advisoryOnly, true);
  });
});

test('ÆTHERGRID backend exposes profile, world-city and quantum runtime surfaces', async () => {
  await withServer(async (baseUrl) => {
    const profileResponse = await fetch(`${baseUrl}/api/aethergrid/profile`);
    assert.equal(profileResponse.status, 200);
    const profile = await profileResponse.json();
    assert.equal(profile.profile.id, 'local-operator');
    assert.equal(typeof profile.profile.displayName, 'string');

    const citiesResponse = await fetch(`${baseUrl}/api/aethergrid/geospatial/cities`);
    assert.equal(citiesResponse.status, 200);
    const cities = await citiesResponse.json();
    assert.ok(cities.cities.length >= 8);
    assert.ok(cities.cities.every((city) => Number.isFinite(city.lat) && Number.isFinite(city.lon)));
    assert.equal(cities.runtime.attribution, '© OpenStreetMap contributors');
    assert.equal(cities.runtime.supportsCustomCoordinates, true);
    assert.deepEqual(cities.runtime.layers, [
      'buildings',
      'building-parts',
      'roofs',
      'roads',
      'power-lines',
      'power-assets',
      'water-areas',
      'waterways',
      'coastline',
      'green-areas',
    ]);

    const environmentRuntimeResponse = await fetch(`${baseUrl}/api/aethergrid/environment/runtime`);
    assert.equal(environmentRuntimeResponse.status, 200);
    const environmentRuntime = await environmentRuntimeResponse.json();
    assert.equal(environmentRuntime.provider, 'open-meteo');
    assert.equal(environmentRuntime.credentialsExposed, false);

    const liveRuntimeResponse = await fetch(`${baseUrl}/api/aethergrid/city-live/runtime`);
    assert.equal(liveRuntimeResponse.status, 200);
    const liveRuntime = await liveRuntimeResponse.json();
    assert.equal(liveRuntime.airQualityProvider, 'open-meteo');
    assert.equal(liveRuntime.seismicProvider, 'usgs');
    assert.equal(liveRuntime.credentialsExposed, false);
    assert.match(liveRuntime.seismicFeed, /M2\.5\+/u);

    const terrainRuntimeResponse = await fetch(`${baseUrl}/api/aethergrid/terrain/runtime`);
    assert.equal(terrainRuntimeResponse.status, 200);
    const terrainRuntime = await terrainRuntimeResponse.json();
    assert.equal(terrainRuntime.provider, 'open-meteo');
    assert.equal(terrainRuntime.credentialsExposed, false);

    const quantumRuntimeResponse = await fetch(`${baseUrl}/api/aethergrid/quantum/runtime`);
    assert.equal(quantumRuntimeResponse.status, 200);
    const quantumRuntime = await quantumRuntimeResponse.json();
    assert.equal(quantumRuntime.provider, 'local-simulator');
    assert.equal(quantumRuntime.hardwareExecution, false);
    assert.deepEqual(quantumRuntime.primitives, ['sampler', 'estimator']);

    const backendsResponse = await fetch(`${baseUrl}/api/aethergrid/quantum/backends`);
    assert.equal(backendsResponse.status, 200);
    const backends = await backendsResponse.json();
    assert.equal(backends.backends[0].name, 'aethergrid-local-sampler');

    const jobResponse = await fetch(`${baseUrl}/api/aethergrid/quantum/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        backend: 'aethergrid-local-sampler',
        shots: 256,
        circuit:
          'OPENQASM 3.0; include "stdgates.inc"; bit[2] c; h $0; cx $0, $1; c[0] = measure $0; c[1] = measure $1;',
      }),
    });
    assert.equal(jobResponse.status, 200);
    const job = await jobResponse.json();
    assert.equal(job.job.provider, 'local-simulator');
    assert.equal(job.job.status, 'COMPLETED');
    assert.equal(job.job.distribution['00'] + job.job.distribution['11'], 256);
    assert.equal(job.evidence.type, 'QUANTUM_JOB');
    assert.equal(job.evidence.details.hardwareExecuted, false);
    assert.match(job.job.receipt, /^[a-f0-9]{64}$/u);
    assert.equal(state.externalContext.quantum.jobId, job.job.id);
    assert.equal(state.externalContext.quantum.provider, 'local-simulator');

    const estimatorResponse = await fetch(`${baseUrl}/api/aethergrid/quantum/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        primitive: 'estimator',
        backend: 'aethergrid-local-sampler',
        circuit:
          'OPENQASM 3.0; include "stdgates.inc"; qubit[2] q; h q[0]; cx q[0], q[1];',
        observable: 'ZZ',
      }),
    });
    assert.equal(estimatorResponse.status, 200);
    const estimator = await estimatorResponse.json();
    assert.equal(estimator.job.programId, 'estimator');
    assert.equal(estimator.job.expectationValue, 1);
    assert.equal(estimator.job.approximation, 'bounded-local-analytic-demo');
    assert.equal(estimator.evidence.details.observable, 'ZZ');
    assert.equal(estimator.evidence.details.expectationValue, 1);
    assert.equal(state.externalContext.quantum.programId, 'estimator');
    assert.equal(state.externalContext.quantum.observable, 'ZZ');
    assert.equal(state.externalContext.quantum.expectationValue, 1);
  });
});

test('ÆTHERGRID city operations derive bounded planning indicators from the active 3D mesh', () => {
  const mesh = {
    city: { id: 'test-city', name: 'Test City', lat: 40.7, lon: -74, radiusM: 900 },
    source: { provider: 'test-mapped-geometry', live: true },
    buildings: [
      { id: 'b1', name: 'Test Landmark', heightM: 92, heightSource: 'height', levels: 28, buildingMaterial: 'glass', footprint: [[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]] },
      { id: 'b2', heightM: 16, minHeightM: 3, footprint: [[60, 10], [82, 10], [82, 30], [60, 30], [60, 10]] },
    ],
    roads: [
      { id: 'r1', highwayType: 'primary', path: [[-400, 0], [0, 0], [400, 0]] },
      { id: 'r2', highwayType: 'residential', path: [[0, -300], [0, 300]] },
    ],
    powerLines: [
      { id: 'p1', voltage: 138000, path: [[-350, -120], [0, -90], [350, -40]] },
    ],
    powerAssets: [
      { id: 's1', powerType: 'substation', position: [100, 100] },
      { id: 'g1', powerType: 'generator', position: [-120, 80] },
    ],
    waterAreas: [
      {
        id: 'w1',
        name: 'Test Basin',
        waterType: 'lake',
        footprint: [[-300, -250], [-80, -250], [-80, -60], [-300, -60], [-300, -250]],
      },
    ],
    waterways: [
      { id: 'wr1', name: 'Test River', waterwayType: 'river', path: [[-420, 180], [0, 140], [420, 120]] },
    ],
    coastlines: [
      { id: 'c1', path: [[-440, 320], [0, 300], [440, 280]] },
    ],
    greenAreas: [
      {
        id: 'g1',
        name: 'Test Park',
        greenType: 'park',
        footprint: [[120, -250], [340, -250], [340, -70], [120, -70], [120, -250]],
      },
    ],
    terrain: {
      minElevationM: 4,
      maxElevationM: 31,
      source: { provider: 'test-terrain', live: true },
    },
    environment: {
      source: { provider: 'test-weather', live: true },
      current: {
        temperatureC: 31,
        apparentTemperatureC: 34,
        relativeHumidityPercent: 72,
        surfacePressureHpa: 1002,
        cloudCoverPercent: 55,
        precipitationMm: 1.2,
        windSpeedKph: 22,
        windGustsKph: 38,
        shortwaveRadiationWm2: 620,
        visibilityM: 12000,
        isDay: true,
      },
      solar: {
        sunrise: '2026-09-30T06:30',
        sunset: '2026-09-30T18:40',
        daylightDurationSeconds: 43800,
      },
    },
    liveContext: {
      airQuality: {
        source: { provider: 'test-air', live: true },
        current: {
          usAqi: 84,
          category: 'moderate',
          pm25UgM3: 21.2,
          pm10UgM3: 34.1,
          uvIndex: 4,
        },
      },
      seismic: {
        source: { provider: 'test-seismic', live: true },
        events: [{ magnitude: 4.4, distanceKm: 140 }],
        eventCount: 1,
        maxMagnitude: 4.4,
      },
    },
  };

  const metrics = cityMeshMetrics(mesh);
  assert.equal(metrics.buildingCount, 2);
  assert.ok(metrics.estimatedFloorAreaM2 > metrics.footprintAreaM2);
  assert.ok(metrics.roadLengthKm > 1);
  assert.ok(metrics.powerLineKm > 0);
  assert.equal(metrics.substations, 1);
  assert.equal(metrics.generationAssets, 1);
  assert.ok(metrics.waterAreaM2 > 0);
  assert.ok(metrics.waterwayLengthKm > 0);
  assert.equal(metrics.waterFeatureCount, 3);
  assert.ok(metrics.greenAreaM2 > 0);
  assert.equal(metrics.greenFeatureCount, 1);
  assert.equal(metrics.namedLandmarkCount, 1);
  assert.equal(metrics.terrainReliefM, 27);

  assert.equal(Object.keys(CITY_USE_CASES).length, 12);
  assert.ok(CITY_USE_CASES['weather-readiness']);
  assert.ok(CITY_USE_CASES['air-quality-exposure']);
  assert.ok(CITY_USE_CASES['seismic-awareness']);
  assert.ok(CITY_USE_CASES['heat-stress']);
  assert.ok(CITY_USE_CASES['visibility-operations']);
  assert.ok(CITY_USE_CASES['flood-context']);
  assert.ok(CITY_USE_CASES['green-infrastructure']);

  for (const id of Object.keys(CITY_USE_CASES)) {
    const analysis = analyzeCityUseCase(mesh, id);
    assert.equal(analysis.useCase.id, id);
    assert.equal(analysis.city.name, 'Test City');
    assert.ok(analysis.planningIndex.value >= 0 && analysis.planningIndex.value <= 100);
    assert.ok(analysis.useCase.recommendedLayers.length >= 4);
    assert.ok(analysis.observations.length >= 3);
    assert.ok(analysis.visualization.animationProfile);
    assert.equal(analysis.visualization.sourceDriven, true);
    assert.equal(analysis.liveSignals.usAqi, 84);
    assert.equal(analysis.liveSignals.relativeHumidityPercent, 72);
    assert.equal(analysis.liveSignals.sunrise, '2026-09-30T06:30');
    assert.equal(analysis.liveSignals.seismicEventCount, 1);
    assert.equal(analysis.dataQuality.liveGeometry, true);
    assert.equal(analysis.dataQuality.liveWeather, true);
    assert.equal(analysis.dataQuality.liveAirQuality, true);
    assert.equal(analysis.dataQuality.liveSeismic, true);
    assert.equal(analysis.dataQuality.mappedWaterFeatures, 3);
    assert.equal(analysis.dataQuality.mappedGreenFeatures, 1);
    assert.equal(analysis.dataQuality.mappedNamedLandmarks, 1);
    assert.equal(analysis.advisoryOnly, true);
  }
});
test('ÆTHERGRID backend exposes a time-indexed 4D spatial graph', async () => {
  assert.deepEqual(spatialGraph.dimensions, ['x', 'y', 'z', 'time']);
  assert.ok(spatialGraph.nodes.length >= 7);
  assert.ok(spatialGraph.routes.length >= 8);
  assert.ok(spatialGraph.structures.length >= 60);

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/aethergrid/spatial?hour=18.5`);
    assert.equal(response.status, 200);
    const graph = await response.json();
    assert.deepEqual(graph.dimensions, ['x', 'y', 'z', 'time']);
    assert.equal(graph.timeHour, 18.5);
    assert.equal(graph.advisoryOnly, true);
    assert.ok(graph.nodes.every((node) => Array.isArray(node.position) && node.position.length === 3));
    assert.ok(graph.routes.every((route) => typeof route.from === 'string' && typeof route.to === 'string'));
    assert.ok(graph.structures.every((item) => Number.isFinite(item.temporalPhase)));
  });
});

test('ÆTHERGRID backend supports live view, region, scenario and telemetry state', async () => {
  await withServer(async (baseUrl) => {
    const view = await fetch(`${baseUrl}/api/aethergrid/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ view: 'forecast' }),
    });
    assert.equal(view.status, 200);
    assert.equal((await view.json()).state.system.view, 'forecast');

    const region = await fetch(`${baseUrl}/api/aethergrid/region`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region: 'Long Island' }),
    });
    assert.equal(region.status, 200);
    assert.equal((await region.json()).state.system.region, 'Long Island');

    const scenario = await fetch(`${baseUrl}/api/aethergrid/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: 'renewable-surge' }),
    });
    assert.equal(scenario.status, 200);
    const scenarioPayload = await scenario.json();
    assert.equal(scenarioPayload.state.system.scenario, 'renewable-surge');
    assert.equal(scenarioPayload.state.system.view, 'scenario');

    const custom = await fetch(`${baseUrl}/api/aethergrid/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scenario: 'custom',
        parameters: {
          loadMultiplierPercent: 132,
          renewableAvailabilityPercent: 148,
          storageReservePercent: 27,
          weatherRiskPercent: 64,
        },
      }),
    });
    assert.equal(custom.status, 200);
    const customPayload = await custom.json();
    assert.equal(customPayload.state.system.scenario, 'custom');
    assert.deepEqual(customPayload.state.system.scenarioParameters, {
      loadMultiplierPercent: 132,
      renewableAvailabilityPercent: 148,
      storageReservePercent: 27,
      weatherRiskPercent: 64,
    });
    assert.equal(customPayload.evidence.type, 'SCENARIO');
    assert.match(customPayload.evidence.receipt, /^[a-f0-9]{64}$/u);

    const telemetry = await fetch(`${baseUrl}/api/aethergrid/telemetry`);
    assert.equal(telemetry.status, 200);
    const telemetryPayload = await telemetry.json();
    assert.equal(typeof telemetryPayload.metrics.loadMw, 'number');
    assert.equal(typeof telemetryPayload.at, 'string');

    const invalid = await fetch(`${baseUrl}/api/aethergrid/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ view: 'actuate' }),
    });
    assert.equal(invalid.status, 400);
  });
});

test('ÆTHERGRID backend streams live telemetry events', async () => {
  await withServer(async (baseUrl) => {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/aethergrid/stream`, {
      signal: controller.signal,
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/event-stream/u);
    const reader = response.body.getReader();
    const first = await reader.read();
    controller.abort();
    const text = new TextDecoder().decode(first.value);
    assert.match(text, /^event: telemetry\ndata: /u);
    assert.match(text, /ADVISORY ONLY/u);
  });
});

test('ÆTHERGRID optimization creates a receipt without actuation authority', async () => {
  const priorRuns = state.optimization.runCount;
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/aethergrid/optimize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        objective: 'emissions',
        weights: { cost: 30, emissions: 85 },
        constraints: { minimumReservePercent: 24, classicalBaselineRequired: true },
        scenario: 'custom',
      }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, 'completed');
    assert.equal(payload.advisoryOnly, true);
    assert.equal(payload.classicalBaselineRequired, true);
    assert.equal(payload.comparison.classical.method, 'deterministic-classical-baseline');
    assert.equal(payload.comparison.experimental.method, 'bounded-experimental-search');
    assert.ok(payload.comparison.experimental.candidateCost > 0);
    assert.ok(payload.comparison.experimental.reliabilityScore > 0);
    assert.match(payload.receipt, /^[a-f0-9]{64}$/u);
    assert.equal(state.optimization.runCount, priorRuns + 1);
  });
});

test('ÆTHERGRID AI collaboration and export are functional', async () => {
  await withServer(async (baseUrl) => {
    const chat = await fetch(`${baseUrl}/api/aethergrid/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'How should we optimize renewable cost?' }),
    });
    assert.equal(chat.status, 200);
    const answer = await chat.json();
    assert.match(answer.reply, /VÆLON/u);
    assert.match(answer.reply, /AUREN/u);
    assert.match(answer.reply, /SOLVÆR/u);
    assert.equal(answer.advisoryOnly, true);

    const exported = await fetch(`${baseUrl}/api/aethergrid/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'operator-report' }),
    });
    assert.equal(exported.status, 200);
    const receipt = await exported.json();
    assert.match(receipt.receipt, /^[a-f0-9]{64}$/u);
    assert.equal(receipt.advisoryOnly, true);
    assert.equal(receipt.state.system.physicalActuation, false);

    const reset = await fetch(`${baseUrl}/api/aethergrid/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(reset.status, 200);
    const resetPayload = await reset.json();
    assert.equal(resetPayload.state.system.region, 'New York Metro');
    assert.equal(resetPayload.state.system.view, 'live');
    assert.equal(resetPayload.state.system.scenario, 'peak-demand');
  });
});
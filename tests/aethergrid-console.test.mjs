import assert from 'node:assert/strict';
import test from 'node:test';

import { server, spatialGraph, state } from '../apps/aethergrid-console/server.mjs';

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
    assert.match(html, /data-global-layer="infrastructure"/u);
    assert.match(html, /id="globalGridStats"/u);
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
    assert.match(html, /id="settingDefaultWorkspace"/u);
    assert.match(html, /id="settingLiveStream"/u);
    assert.match(html, /id="profileForm"/u);
    assert.match(html, /id="profileAvatarInput"/u);
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
    assert.match(appSource, /powerAssets/u);
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
      'roads',
      'power-lines',
      'power-assets',
    ]);

    const quantumRuntimeResponse = await fetch(`${baseUrl}/api/aethergrid/quantum/runtime`);
    assert.equal(quantumRuntimeResponse.status, 200);
    const quantumRuntime = await quantumRuntimeResponse.json();
    assert.equal(quantumRuntime.provider, 'local-simulator');
    assert.equal(quantumRuntime.hardwareExecution, false);

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
  });
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
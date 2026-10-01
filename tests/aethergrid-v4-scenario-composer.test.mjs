import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 operator scenarios are bounded persistent modeled records with explicit non-authoritative semantics', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(service, /aethergrid\.operator\.scenarios\.v4/u);
  assert.match(service, /MAX_OPERATOR_SCENARIOS = 8/u);
  assert.match(service, /authoritative: false/u);
  assert.match(service, /modeled: true/u);
  assert.match(service, /operator-scenario\.v1/u);
  assert.match(service, /version: 1/u);
  assert.match(service, /parentScenarioId: null/u);
  assert.match(service, /branchOperatorScenario/u);
  assert.doesNotMatch(service, /fetch\(/u);
  assert.doesNotMatch(service, /\/api\/aethergrid\//u);
});

test('v4 scenario normalization preserves legitimate zero-valued parameters', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(service, /function finiteOr/u);
  assert.match(service, /Number\.isFinite\(number\) \? number : fallback/u);
  assert.doesNotMatch(service, /Number\(parameters\.renewableAvailabilityPercent\) \|\| 100/u);
  assert.doesNotMatch(service, /Number\(parameters\.storageReservePercent\) \|\| 18/u);
});

test('v4 persisted active scenario status does not silently reactivate after reload', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(
    service,
    /status: scenario\.status === 'active' \? 'draft' : scenario\.status/u,
  );
});

test('v4 scenario creation freezes references and baseline context instead of claiming live source output', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(service, /canonicalEntityIds/u);
  assert.match(service, /incidentIds/u);
  assert.match(service, /observationIds/u);
  assert.match(service, /baseline:/u);
  assert.match(service, /positionedEntityCount/u);
  assert.match(service, /analyticalEdgeCount/u);
  assert.match(service, /totalTreeDistanceMeters/u);
  assert.match(service, /maximumPairDistanceMeters/u);
});

test('v4 scenario comparison is a parameter/model comparison against an explicit neutral baseline', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(service, /NEUTRAL_SCENARIO_PARAMETERS/u);
  assert.match(service, /compareOperatorScenario/u);
  assert.match(service, /loadMultiplierPercent:/u);
  assert.match(service, /renewableAvailabilityPercent:/u);
  assert.match(service, /storageReservePercent:/u);
  assert.match(service, /weatherRiskPercent:/u);
  assert.match(service, /scenarioVisualState/u);
});

test('v4 scenario overlay is time-bounded modeled geometry and never provider telemetry', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(service, /layerId: 'scenario-model'/u);
  assert.match(service, /analysisType: 'scenario-model'/u);
  assert.match(service, /validFrom: scenario\.startIso/u);
  assert.match(service, /validTo: scenario\.endIso/u);
  assert.match(service, /Local operator scenario model · non-authoritative/u);
  assert.match(service, /live: false/u);
  assert.match(service, /sourceTime: null/u);
  assert.match(service, /sourceDataset: 'local-operator-scenario'/u);
  assert.doesNotMatch(service, /charCodeAt/u);
  assert.doesNotMatch(service, /variability/u);
});

test('v4 scenario composer exposes assumptions persistence comparison activation and export with truth boundaries', async () => {
  const panel = await text(
    'apps/aethergrid-console/web/src/components/ScenarioComposerPanel.tsx',
  );

  assert.match(panel, /4D SCENARIO COMPOSER/u);
  assert.match(panel, /SAVE HYPOTHETICAL SCENARIO/u);
  assert.match(panel, /ADD ASSUMPTION/u);
  assert.match(panel, /ACTIVATE MODEL/u);
  assert.match(panel, /ANALYZE WITH VÆLON/u);
  assert.match(panel, /BRANCH VERSION/u);
  assert.match(panel, /EXPORT JSON/u);
  assert.match(panel, /HYPOTHETICAL MODEL · NOT LIVE \/ NOT FORECAST/u);
  assert.match(panel, /not provider[\s\S]*telemetry/u);
  assert.match(panel, /not[\s\S]*probabilistic forecasts/u);
});

test('v4 app activates local scenarios in scenario time and synchronizes scenario visuals without conflating them with backend presets', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const activateOperatorScenario/u);
  assert.match(app, /compareOperatorScenario\(scenario\)/u);
  assert.match(app, /clock\.setMode\('scenario', scenario\.id\)/u);
  assert.match(app, /clock\.scrub\(scenario\.startIso, 'scenario'\)/u);
  assert.match(app, /setScenarioVisual\(comparison\.visual\)/u);
  assert.match(app, /<ScenarioComposerPanel/u);
  assert.match(app, /onScenarioApplied=\{\(scenarioId, visual\)/u);
  assert.match(app, /setScenarioVisual\(visual\)/u);
});

test('v4 VÆLON scenario handoff explicitly separates hypothetical model inputs from evidence and forecasts', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const analyzeOperatorScenario/u);
  assert.match(app, /agent: 'VÆLON'/u);
  assert.match(app, /hypothetical operator input/u);
  assert.match(app, /Do not call it live data/u);
  assert.match(app, /provider forecast/u);
  assert.match(app, /probability/u);
  assert.match(app, /causal finding/u);
  assert.match(app, /verified real-world outcome/u);
});

test('v4 scenario model overlay participates in both world and city rendering while remaining separately toggleable', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /\{ id: 'scenario-model', visible: true \}/u);
  assert.match(
    app,
    /worldOverlay,[\s\S]*incidentOverlay,[\s\S]*worksetGeometryOverlay,[\s\S]*operatorScenarioOverlay,[\s\S]*measurementOverlay/u,
  );
  assert.match(
    app,
    /seismicOverlay,[\s\S]*incidentOverlay,[\s\S]*worksetGeometryOverlay,[\s\S]*operatorScenarioOverlay,[\s\S]*measurementOverlay/u,
  );
  assert.match(app, /'scenario-model': operatorScenarioOverlay/u);
});

test('v4 Cesium and native renderers visually distinguish scenario-model geometry from live infrastructure', async () => {
  const [cesium, native] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
  ]);

  for (const renderer of [cesium, native]) {
    assert.match(renderer, /scenario-model/u);
    assert.match(renderer, /#d991ff/u);
  }
});

test('v4 scenario export is explicitly modeled and warns that it is not observation forecast or verified outcome', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-scenario.ts',
  );

  assert.match(service, /operator-scenario-export\.v1/u);
  assert.match(service, /operator-authored hypothetical scenario/i);
  assert.match(service, /not observations/u);
  assert.match(service, /forecasts/u);
  assert.match(service, /verified real-world outcomes/u);
});

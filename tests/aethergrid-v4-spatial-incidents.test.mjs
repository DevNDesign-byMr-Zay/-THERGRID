import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 operator incidents are bounded local records with explicit non-authoritative truth boundaries', async () => {
  const incidents = await text(
    'apps/aethergrid-console/web/src/services/spatial-incidents.ts',
  );

  assert.match(incidents, /aethergrid\.operator\.spatial-incidents\.v4/u);
  assert.match(incidents, /MAX_SPATIAL_INCIDENTS = 48/u);
  assert.match(incidents, /authoritative: false/u);
  assert.match(incidents, /operatorGenerated: true/u);
  assert.match(incidents, /Local operator-created annotations and incident records/u);
  assert.match(incidents, /not provider telemetry/u);
  assert.doesNotMatch(incidents, /fetch\(/u);
  assert.doesNotMatch(incidents, /\/api\/aethergrid\//u);
});

test('v4 operator incidents preserve 4D observation and lifecycle times without claiming provider source time', async () => {
  const incidents = await text(
    'apps/aethergrid-console/web/src/services/spatial-incidents.ts',
  );

  assert.match(incidents, /observedAt: input\.temporal\.iso/u);
  assert.match(incidents, /temporalMode: input\.temporal\.mode/u);
  assert.match(incidents, /sourceTime: input\.temporal\.sourceTime/u);
  assert.match(incidents, /resolvedAt:/u);
  assert.match(incidents, /temporalIso/u);
  assert.match(incidents, /validFrom: incident\.observedAt/u);
  assert.match(incidents, /validTo: incident\.resolvedAt/u);
});

test('v4 operator incidents bind to canonical entities and only record a workset link when that canonical entity is actually pinned', async () => {
  const incidents = await text(
    'apps/aethergrid-console/web/src/services/spatial-incidents.ts',
  );

  assert.match(incidents, /dossier\?\.entity\.canonicalId/u);
  assert.match(incidents, /loadSpatialWorkset/u);
  assert.match(incidents, /item\.canonicalId === canonicalId/u);
  assert.match(incidents, /linkedWorksetCanonicalId: pinned \? canonicalId : null/u);
  assert.match(incidents, /syncSpatialIncidentWorksetLink/u);
  assert.match(incidents, /gersId: dossier\?\.entity\.gersId/u);
});

test('v4 incident overlay creates selectable map events with explicit local-annotation provenance', async () => {
  const incidents = await text(
    'apps/aethergrid-console/web/src/services/spatial-incidents.ts',
  );

  assert.match(incidents, /layerId: 'annotations'/u);
  assert.match(incidents, /kind: 'event' as const/u);
  assert.match(incidents, /eventType: 'operator-incident'/u);
  assert.match(incidents, /sourceFeatureId: incident\.id/u);
  assert.match(incidents, /sourceDataset: 'local-operator-incidents'/u);
  assert.match(incidents, /Local operator annotation · non-authoritative/u);
  assert.match(incidents, /live: false/u);
  assert.match(incidents, /fallback: false/u);
});

test('v4 incident UI supports create lifecycle notes locate workset sync AUREN review and bounded export', async () => {
  const panel = await text(
    'apps/aethergrid-console/web/src/components/SpatialIncidentPanel.tsx',
  );

  assert.match(panel, /4D OPERATOR ANNOTATIONS/u);
  assert.match(panel, /ADD TO 4D MAP/u);
  assert.match(panel, /OPEN/u);
  assert.match(panel, /MONITORING/u);
  assert.match(panel, /RESOLVED/u);
  assert.match(panel, /DISMISSED/u);
  assert.match(panel, /SYNC WORKSET/u);
  assert.match(panel, /EXPORT INCIDENTS JSON/u);
  assert.match(panel, /OPERATOR-CREATED · NON-AUTHORITATIVE/u);
  assert.match(panel, /Status changes describe the operator record only/u);
});

test('v4 app renders incidents in world and city scenes while incident navigation clears selection', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /\{ id: 'annotations', visible: true \}/u);
  assert.match(app, /spatialIncidentsToOverlay/u);
  assert.match(app, /\[worldOverlay, incidentOverlay, measurementOverlay\]/u);
  assert.match(app, /seismicOverlay,[\s\S]*incidentOverlay,[\s\S]*measurementOverlay/u);
  assert.match(app, /const locateSpatialIncident/u);
  assert.match(app, /setSelection\(null\)/u);
  assert.match(app, /name: 'INCIDENT ANCHOR'/u);
  assert.match(app, /<SpatialIncidentPanel/u);
});

test('v4 AUREN incident review cannot silently promote operator severity or status into source-backed fact', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const analyzeSpatialIncident/u);
  assert.match(app, /non-authoritative operator annotation/u);
  assert.match(app, /Do not treat its severity\/status as provider-confirmed fact/u);
  assert.match(app, /do not infer causation/u);
  assert.match(app, /source-backed evidence would be required/u);
});

test('v4 Cesium and native renderers visually distinguish local incident severity without changing incident data', async () => {
  const [cesium, native] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
  ]);

  for (const renderer of [cesium, native]) {
    assert.match(renderer, /operator-incident/u);
    assert.match(renderer, /critical/u);
    assert.match(renderer, /high/u);
    assert.match(renderer, /medium/u);
    assert.match(renderer, /low/u);
    assert.match(renderer, /#ff4f63/u);
    assert.match(renderer, /#8dc9ff/u);
  }
});

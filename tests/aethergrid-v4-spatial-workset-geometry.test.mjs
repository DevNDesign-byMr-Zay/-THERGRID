import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 workset geometry builds a non-authoritative minimum spanning analysis over positioned canonical entities', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/spatial-workset-geometry.ts',
  );

  assert.match(service, /minimum-spanning-analysis/u);
  assert.match(service, /authoritative: false/u);
  assert.match(service, /greatCircleDistanceMeters/u);
  assert.match(service, /minimumSpanningEdges/u);
  assert.match(service, /maximumPairDistance/u);
  assert.match(service, /sphericalCentroid/u);
  assert.match(service, /temporalSpanMs/u);
  assert.doesNotMatch(service, /fetch\(/u);
  assert.doesNotMatch(service, /\/api\/aethergrid\//u);
});

test('v4 workset geometry excludes pins without usable coordinates rather than fabricating positions', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/spatial-workset-geometry.ts',
  );

  assert.match(service, /position\.latitude == null/u);
  assert.match(service, /position\.longitude == null/u);
  assert.match(service, /!Number\.isFinite\(position\.latitude\)/u);
  assert.match(service, /!Number\.isFinite\(position\.longitude\)/u);
  assert.match(service, /omittedEntityCount/u);
});

test('v4 workset graph renders only analytical points and analysis lines with local provenance', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/spatial-workset-geometry.ts',
  );

  assert.match(service, /layerId: 'workset-analysis'/u);
  assert.match(service, /kind: 'analysis-point' as const/u);
  assert.match(service, /kind: 'analysis-line' as const/u);
  assert.match(service, /analysisType: 'workset-geometry'/u);
  assert.match(service, /sourceDataset: 'local-operator-workset-geometry'/u);
  assert.match(service, /Local operator analytical geometry · non-authoritative/u);
  assert.match(service, /live: false/u);
  assert.match(service, /fallback: false/u);
});

test('v4 workset geometry panel explicitly rejects inferred real-world relationships', async () => {
  const panel = await text(
    'apps/aethergrid-console/web/src/components/SpatialWorksetGeometryPanel.tsx',
  );

  assert.match(panel, /SPATIAL RELATIONSHIP GRAPH/u);
  assert.match(panel, /MINIMUM-SPANNING ANALYSIS/u);
  assert.match(panel, /CENTER GRAPH/u);
  assert.match(panel, /ANALYZE WITH AUREN/u);
  assert.match(panel, /ANALYTICAL GEOMETRY · NON-AUTHORITATIVE/u);
  assert.match(panel, /spatial proximity only/u);
  assert.match(panel, /do not assert physical/u);
  assert.match(panel, /electrical/u);
  assert.match(panel, /transit/u);
  assert.match(panel, /ownership/u);
  assert.match(panel, /dependency/u);
  assert.match(panel, /causal relationships/u);
});

test('v4 app synchronizes workset persistence into the graph and renders it in world and city scopes', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /loadSpatialWorkset/u);
  assert.match(app, /SPATIAL_WORKSET_EVENT/u);
  assert.match(app, /buildSpatialWorksetGeometry/u);
  assert.match(app, /spatialWorksetGeometryToOverlay/u);
  assert.match(app, /\{ id: 'workset-analysis', visible: true \}/u);
  assert.match(app, /worldOverlay, incidentOverlay, worksetGeometryOverlay, operatorScenarioOverlay, measurementOverlay/u);
  assert.match(
    app,
    /seismicOverlay,[\s\S]*incidentOverlay,[\s\S]*worksetGeometryOverlay,[\s\S]*operatorScenarioOverlay,[\s\S]*measurementOverlay/u,
  );
  assert.match(app, /<SpatialWorksetGeometryPanel/u);
});

test('v4 workset graph centering uses only the analytical centroid and clears active selection', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const centerWorksetGeometry/u);
  assert.match(app, /worksetGeometry\.centroid/u);
  assert.match(app, /setSelection\(null\)/u);
  assert.match(app, /name: 'WORKSET GEOMETRY'/u);
  assert.match(app, /analytical centroid/u);
  assert.match(app, /custom: true/u);
});

test('v4 AUREN workset geometry review carries an explicit anti-causality relationship boundary', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const analyzeWorksetGeometry/u);
  assert.match(app, /minimum-spanning spatial geometry/u);
  assert.match(
    app,
    /Do not infer physical, electrical, transit, ownership, dependency, operational, or causal relationships/u,
  );
  assert.match(
    app,
    /source-backed evidence required before asserting any real-world relationship/u,
  );
});

test('v4 Cesium and native renderers visually distinguish workset geometry without changing its source semantics', async () => {
  const [cesium, native] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
  ]);

  for (const renderer of [cesium, native]) {
    assert.match(renderer, /workset-geometry/u);
    assert.match(renderer, /#63ffc5/u);
  }
});

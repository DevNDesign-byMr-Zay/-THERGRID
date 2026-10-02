import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 semantic identity prefers explicit GERS but never fabricates a cross-source join', async () => {
  const identity = await text(
    'apps/aethergrid-console/web/src/services/spatial-entity-identity.ts',
  );

  assert.match(identity, /GERS_KEYS/u);
  assert.match(identity, /overtureGersId/u);
  assert.match(identity, /if \(gersId\)/u);
  assert.match(identity, /canonicalId: `gers:\$\{gersId\}`/u);
  assert.match(identity, /crossSourceJoinReady: true/u);
  assert.match(identity, /canonicalId: `osm:\$\{osmId\}`/u);
  assert.match(identity, /basis: 'source-native'/u);
  assert.match(identity, /basis: 'scene-derived'/u);
  assert.match(identity, /crossSourceJoinReady: false/u);
  assert.doesNotMatch(identity, /gersId:\s*(?:selection\.id|osmId|sourceFeatureId)/u);
});

test('v4 mapped scene segments bind back to their real source feature IDs', async () => {
  const overlays = await text('apps/aethergrid-console/web/src/services/city-power-overlay.ts');

  assert.match(overlays, /sourceFeatureId: featureId/u);
  assert.match(overlays, /sourceFeatureId: area\.id/u);
  assert.match(overlays, /sourceFeatureId: item\.building\.id/u);
  assert.match(overlays, /sourceFeatureId: asset\.id/u);
  assert.match(overlays, /sourceFeatureId: line\.id/u);
  assert.match(overlays, /sourceDataset: 'osm-overpass'/u);
  assert.match(overlays, /cityId: mesh\.city\.id/u);
});

test('v4 operator context carries canonical identity into selection AI and frame comparison', async () => {
  const [app, comparison, panel, dossierPanel] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/services/spatial-comparison.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialComparisonPanel.tsx'),
    text('apps/aethergrid-console/web/src/components/EntityDossierPanel.tsx'),
  ]);

  assert.match(app, /bindSpatialSelectionIdentity/u);
  assert.match(app, /canonicalId: selection\.identity\?\.canonicalId/u);
  assert.match(app, /crossSourceJoinReady/u);
  assert.match(dossierPanel, /GERS LINKED/u);
  assert.match(dossierPanel, /NO GERS JOIN/u);
  assert.match(app, /Identity basis:/u);
  assert.match(app, /Entity relationship:/u);

  assert.match(comparison, /canonicalId:/u);
  assert.match(comparison, /identityBasis:/u);
  assert.match(comparison, /sourceFeatureId:/u);
  assert.match(comparison, /sameCanonicalEntity/u);
  assert.match(comparison, /aethergrid\.operator-spatial-comparison\.v2/u);

  assert.match(panel, /comparison\.sameCanonicalEntity/u);
  assert.match(panel, /scene proximity is never treated as identity/u);
});

test('v4 renderer manager retains the selected scene feature across engine activation', async () => {
  const manager = await text('apps/aethergrid-console/web/src/renderer/renderer-manager.ts');
  const overlayLayer = await text(
    'apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts',
  );

  assert.match(manager, /#selectedFeatureId: string \| null/u);
  assert.match(manager, /this\.#selectedFeatureId = id/u);
  assert.match(manager, /renderer\.selectFeature\(this\.#selectedFeatureId\)/u);
  assert.match(overlayLayer, /sourceName: node\.label \?\? node\.id/u);
  assert.match(overlayLayer, /sourceName: edge\.label \?\? edge\.id/u);
});

test('v4 source-feature selection highlights complete mapped features in both renderers', async () => {
  const [cesiumLayer, cesiumRenderer, nativeRenderer] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
  ]);

  assert.match(cesiumLayer, /selectSourceFeature\(sourceFeatureId: string \| null\)/u);
  assert.match(cesiumLayer, /#applySelectionHighlight/u);
  assert.match(cesiumLayer, /properties\?\.sourceFeatureId/u);
  assert.match(cesiumLayer, /edgeWidth\(edge, intensity\) \* 1\.75/u);
  assert.match(cesiumRenderer, /selectSourceFeature\(sourceFeatureId\)/u);
  assert.match(cesiumRenderer, /overlay\.clearSelection\(\)/u);

  assert.match(nativeRenderer, /#selectedSourceFeatureId: string \| null/u);
  assert.match(nativeRenderer, /#selectedLayerId: string \| null/u);
  assert.match(nativeRenderer, /#isSelectedSource/u);
  assert.match(nativeRenderer, /snapshot\.edges\.find/u);
  assert.match(nativeRenderer, /snapshot\.areas/u);
  assert.match(nativeRenderer, /selected\s*\?\s*'#ffffff'/u);
});

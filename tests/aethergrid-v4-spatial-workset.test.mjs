import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 spatial worksets are bounded local operator state keyed by canonical identity', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/spatial-workset.ts',
  );

  assert.match(service, /aethergrid\.operator\.spatial-workset\.v4/u);
  assert.match(service, /MAX_SPATIAL_WORKSET_ITEMS = 12/u);
  assert.match(service, /candidate\.canonicalId === item\.canonicalId/u);
  assert.match(service, /candidate\.canonicalId !== frozen\.entity\.canonicalId/u);
  assert.match(service, /localStorage\.setItem/u);
  assert.match(service, /localStorage\.removeItem/u);
});

test('v4 workset pins frozen entity dossiers without mutating their original capture time on load', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/spatial-workset.ts',
  );

  assert.match(service, /freezeSpatialEntityDossier\(dossier\)/u);
  assert.match(service, /cloneFrozenDossier/u);
  assert.match(service, /JSON\.parse\(JSON\.stringify\(dossier\)\)/u);
  assert.doesNotMatch(
    service,
    /dossier: freezeSpatialEntityDossier\(item\.dossier\)/u,
  );
});

test('v4 workset exports remain explicitly non-authoritative and do not claim coordinate restore reselects an entity', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/spatial-workset.ts',
  );

  assert.match(service, /aethergrid\.operator-spatial-workset\.v1/u);
  assert.match(service, /authoritative: false/u);
  assert.match(service, /Coordinates are navigation anchors only/u);
  assert.match(service, /does not prove that the original entity has been reselected/u);
  assert.match(service, /downloadSpatialWorkset/u);
});

test('v4 workset UI exposes pin locate AUREN remove and export controls with source-state disclosure', async () => {
  const panel = await text(
    'apps/aethergrid-console/web/src/components/SpatialWorksetPanel.tsx',
  );

  assert.match(panel, /MULTI-ENTITY WORKSET/u);
  assert.match(panel, /PIN ACTIVE/u);
  assert.match(panel, /UPDATE PIN/u);
  assert.match(panel, /LOCATE/u);
  assert.match(panel, /AUREN/u);
  assert.match(panel, /REMOVE/u);
  assert.match(panel, /EXPORT WORKSET JSON/u);
  assert.match(panel, /data-source-state/u);
  assert.match(panel, /LOCAL WORKSET · NON-AUTHORITATIVE/u);
});

test('v4 workset coordinate navigation clears scene selection instead of asserting entity reselection', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const locateEntityDossier/u);
  assert.match(app, /setSelection\(null\)/u);
  assert.match(app, /name: 'WORKSET ANCHOR'/u);
  assert.match(app, /custom: true/u);
  assert.match(app, /<SpatialWorksetPanel/u);
  assert.match(app, /onLocate=\{locateEntityDossier\}/u);
  assert.match(app, /onAnalyze=\{analyzeEntityDossier\}/u);
});

test('v4 workset panel keeps local persistence separate from server evidence and provider APIs', async () => {
  const [service, panel] = await Promise.all([
    text('apps/aethergrid-console/web/src/services/spatial-workset.ts'),
    text('apps/aethergrid-console/web/src/components/SpatialWorksetPanel.tsx'),
  ]);

  assert.doesNotMatch(service, /fetch\(/u);
  assert.doesNotMatch(panel, /fetch\(/u);
  assert.doesNotMatch(service, /\/api\/aethergrid\//u);
  assert.match(panel, /Pinned dossiers are frozen local snapshots/u);
  assert.match(panel, /does not claim the original source feature has been reselected or is still live/u);
});

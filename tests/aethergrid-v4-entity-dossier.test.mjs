import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 entity dossiers preserve canonical identity and remain explicitly non-authoritative', async () => {
  const dossier = await text('apps/aethergrid-console/web/src/services/spatial-entity-dossier.ts');

  assert.match(dossier, /aethergrid\.operator-entity-dossier\.v1/u);
  assert.match(dossier, /authoritative: false/u);
  assert.match(dossier, /canonicalId/u);
  assert.match(dossier, /identityBasis/u);
  assert.match(dossier, /crossSourceJoinReady/u);
  assert.match(dossier, /gersId/u);
  assert.match(dossier, /osmId/u);
  assert.match(dossier, /scene-context-only/u);
  assert.match(dossier, /not a server evidence-ledger record/u);
  assert.match(dossier, /must not be treated as a GERS join/u);
});

test('v4 entity dossiers keep entity provenance separate from surrounding contextual sources', async () => {
  const dossier = await text('apps/aethergrid-console/web/src/services/spatial-entity-dossier.ts');

  assert.match(dossier, /role: 'entity'/u);
  assert.match(dossier, /role: 'city-geometry'/u);
  assert.match(dossier, /role: 'weather'/u);
  assert.match(dossier, /role: 'air-quality'/u);
  assert.match(dossier, /role: 'seismic'/u);
  assert.match(dossier, /EntitySourceState/u);
  assert.match(dossier, /'live'/u);
  assert.match(dossier, /'stale'/u);
  assert.match(dossier, /'fallback'/u);
  assert.match(dossier, /'recorded'/u);
});

test('v4 entity dossier export filters scalar scene properties and defensive secret-shaped keys', async () => {
  const dossier = await text('apps/aethergrid-console/web/src/services/spatial-entity-dossier.ts');

  assert.match(dossier, /SENSITIVE_KEY/u);
  assert.match(dossier, /api\.\?key/u);
  assert.match(dossier, /authorization/u);
  assert.match(dossier, /service\.\?crn/u);
  assert.match(dossier, /slice\(0, 24\)/u);
  assert.match(dossier, /Non-authoritative operator snapshot/u);
  assert.match(dossier, /downloadSpatialEntityDossier/u);
});

test('v4 dossiers omit current-only context outside LIVE mode and match A/B frames by canonical identity', async () => {
  const [app, dossier] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/services/spatial-entity-dossier.ts'),
  ]);

  assert.match(app, /temporal\.mode === 'live' \? atmosphere : null/u);
  assert.match(app, /temporal\.mode === 'live'[\s\S]*\? liveContext[\s\S]*: null/u);
  assert.match(dossier, /observation\.selectedEntity\.canonicalId !== canonicalId/u);
  assert.match(dossier, /matchingObservations/u);
  assert.match(
    dossier,
    /Current-only weather, air-quality and seismic context is intentionally omitted outside LIVE mode/u,
  );
});

test('v4 dossier UI supports frozen 4D snapshots, local export and bounded AUREN review', async () => {
  const [app, panel] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/EntityDossierPanel.tsx'),
  ]);

  assert.match(app, /frozenDossier/u);
  assert.match(app, /freezeSpatialEntityDossier/u);
  assert.match(app, /analyzeEntityDossier/u);
  assert.match(app, /Treat the dossier as non-authoritative operator analysis/u);
  assert.match(app, /do not infer a GERS join or causation/u);

  assert.match(panel, /FROZEN 4D SNAPSHOT/u);
  assert.match(panel, /FREEZE 4D SNAPSHOT/u);
  assert.match(panel, /EXPORT DOSSIER JSON/u);
  assert.match(panel, /ANALYZE WITH AUREN/u);
  assert.match(panel, /LOCAL OPERATOR SNAPSHOT · NON-AUTHORITATIVE/u);
});

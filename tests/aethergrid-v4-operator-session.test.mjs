import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 operator sessions are bounded local non-authoritative workspace snapshots', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-session.ts',
  );

  assert.match(service, /aethergrid\.operator\.workspace-sessions\.v4/u);
  assert.match(service, /MAX_OPERATOR_SESSIONS = 8/u);
  assert.match(service, /aethergrid\.operator-workspace-session\.v1/u);
  assert.match(service, /authoritative: false/u);
  assert.match(service, /activeSelectionRestored: false/u);
  assert.match(service, /resume-current-live/u);
  assert.match(service, /revalidate-after-restore/u);
  assert.doesNotMatch(service, /fetch\(/u);
  assert.doesNotMatch(service, /\/api\/aethergrid\//u);
});

test('v4 operator session payload preserves workspace analysis without persisting a stale active scene selection', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-session.ts',
  );

  assert.match(service, /interactionMode/u);
  assert.match(service, /measurementPoints/u);
  assert.match(service, /measurementFrame/u);
  assert.match(service, /observationA/u);
  assert.match(service, /observationB/u);
  assert.match(service, /frozenDossier/u);
  assert.match(service, /workset/u);
  assert.match(service, /incidents/u);
  assert.doesNotMatch(service, /selection: SpatialFeatureSelection/u);
  assert.doesNotMatch(service, /activeSelection:/u);
});

test('v4 session export states that restore does not reselect or prove source freshness', async () => {
  const service = await text(
    'apps/aethergrid-console/web/src/services/operator-session.ts',
  );

  assert.match(service, /operator-workspace-session-export\.v1/u);
  assert.match(service, /does not reselect or revalidate any source entity/u);
  assert.match(service, /does not prove source freshness/u);
  assert.match(service, /resumes current time for sessions saved in LIVE mode/u);
});

test('v4 session UI captures current workset through synchronized local workset state', async () => {
  const [panel, workset] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/OperatorSessionPanel.tsx'),
    text('apps/aethergrid-console/web/src/services/spatial-workset.ts'),
  ]);

  assert.match(panel, /OPERATOR SESSIONS/u);
  assert.match(panel, /SAVE SESSION/u);
  assert.match(panel, /RESTORE/u);
  assert.match(panel, /EXPORT/u);
  assert.match(panel, /WORKSPACE SNAPSHOT · NON-AUTHORITATIVE/u);
  assert.match(panel, /SPATIAL_WORKSET_EVENT/u);
  assert.match(panel, /loadSpatialWorkset/u);
  assert.match(panel, /createOperatorSession\(name, \{ \.\.\.current, workset \}\)/u);
  assert.match(workset, /aethergrid:spatial-workset-changed/u);
  assert.match(workset, /notifyWorksetChanged/u);
});

test('v4 app restores live sessions to current live time and never restores a saved selection', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /const restoreOperatorSession/u);
  assert.match(app, /setSelection\(null\)/u);
  assert.match(app, /restoreBookmark/u);
  assert.match(app, /if \(bookmark\.temporalMode === 'live'\) \{[\s\S]*clock\.goLive\(\)/u);
  assert.match(app, /saveSpatialWorkset\(session\.workspace\.workset\)/u);
  assert.match(app, /saveSpatialIncidents\(session\.workspace\.incidents\)/u);
  assert.match(app, /setPendingSessionRestore\(session\)/u);
  assert.match(app, /<OperatorSessionPanel/u);
});

test('v4 session restore applies analysis state after city reset and preserves frozen dossier capture time', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /if \(!pendingSessionRestore\) return/u);
  assert.match(app, /setMeasurementPoints/u);
  assert.match(app, /setMeasurementFrame/u);
  assert.match(app, /setObservationA/u);
  assert.match(app, /setObservationB/u);
  assert.match(app, /JSON\.parse\([\s\S]*JSON\.stringify\(workspace\.frozenDossier\)/u);
  assert.doesNotMatch(
    app,
    /freezeSpatialEntityDossier\(workspace\.frozenDossier\)/u,
  );
});

test('v4 operator sessions preserve LIVE truth boundary while restoring historical forecast and scenario cursors through bookmark semantics', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /bookmark\.temporalMode === 'scenario'/u);
  assert.match(app, /clock\.setMode\('scenario', bookmark\.scenarioId \?\? null\)/u);
  assert.match(app, /clock\.scrub\(bookmark\.cursorIso, 'scenario'\)/u);
  assert.match(app, /clock\.scrub\(bookmark\.cursorIso, bookmark\.temporalMode\)/u);
  assert.match(app, /clock\.goLive\(\)/u);
});

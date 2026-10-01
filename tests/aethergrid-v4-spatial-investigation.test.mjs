import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 spatial investigations are bounded local operator assessments and never authoritative findings', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/spatial-investigation.ts');

  assert.match(service, /aethergrid\.operator\.spatial-investigations\.v4/u);
  assert.match(service, /MAX_SPATIAL_INVESTIGATIONS = 6/u);
  assert.match(service, /authoritative: false/u);
  assert.match(service, /operatorAssessment: true/u);
  assert.match(service, /untested/u);
  assert.match(service, /supported/u);
  assert.match(service, /contradicted/u);
  assert.match(service, /inconclusive/u);
  assert.doesNotMatch(service, /fetch\(/u);
  assert.doesNotMatch(service, /\/api\/aethergrid\//u);
});

test('v4 investigations link existing source and operator records by reference instead of copying backend evidence', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/spatial-investigation.ts');

  assert.match(service, /canonicalEntityIds/u);
  assert.match(service, /incidentIds/u);
  assert.match(service, /observationIds/u);
  assert.match(service, /evidenceReceipts/u);
  assert.match(service, /record\.receipt \|\| record\.id/u);
  assert.match(service, /attachSpatialInvestigationContext/u);
  assert.match(service, /attachEvidenceToInvestigation/u);
  assert.doesNotMatch(service, /details: evidence/u);
});

test('v4 investigation geometry snapshots remain explicitly non-authoritative analytical context', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/spatial-investigation.ts');

  assert.match(service, /SpatialInvestigationGeometrySnapshot/u);
  assert.match(service, /relationshipBasis/u);
  assert.match(service, /totalTreeDistanceMeters/u);
  assert.match(service, /maximumPairDistanceMeters/u);
  assert.match(service, /authoritative: false/u);
});

test('v4 investigation export warns that hypothesis assessments are human-entered and evidence must be revalidated', async () => {
  const service = await text('apps/aethergrid-console/web/src/services/spatial-investigation.ts');

  assert.match(service, /operator-spatial-investigation-export\.v1/u);
  assert.match(service, /Hypothesis assessments are human-entered analytical judgments/u);
  assert.match(service, /not verified provider findings/u);
  assert.match(service, /should be revalidated independently/u);
});

test('v4 investigation board exposes case creation context attachment hypothesis assessment and evidence linking', async () => {
  const panel = await text(
    'apps/aethergrid-console/web/src/components/SpatialInvestigationBoard.tsx',
  );

  assert.match(panel, /SPATIAL INVESTIGATION BOARD/u);
  assert.match(panel, /NEW INVESTIGATION/u);
  assert.match(panel, /ATTACH CURRENT CONTEXT/u);
  assert.match(panel, /LINK SELECTED EVIDENCE/u);
  assert.match(panel, /ADD HYPOTHESIS/u);
  assert.match(panel, /ADD QUESTION/u);
  assert.match(panel, /ADD NOTE/u);
  assert.match(panel, /ANALYZE WITH TEAM/u);
  assert.match(panel, /EXPORT CASE JSON/u);
  assert.match(panel, /OPERATOR ASSESSMENT · NOT A VERIFIED FINDING/u);
});

test('v4 investigation board labels supported contradicted and inconclusive as operator-entered states', async () => {
  const panel = await text(
    'apps/aethergrid-console/web/src/components/SpatialInvestigationBoard.tsx',
  );

  assert.match(panel, /SUPPORTED \/ CONTRADICTED \/ INCONCLUSIVE/u);
  assert.match(panel, /human-entered analytical/u);
  assert.match(panel, /Linked evidence remains a separate provenance record/u);
  assert.match(panel, /must[\s\S]*be inspected independently/u);
});

test('v4 Evidence panel can hand a selected provenance record to the investigation board without mutating evidence', async () => {
  const evidence = await text('apps/aethergrid-console/web/src/components/EvidencePanel.tsx');

  assert.match(evidence, /onSelectEvidence\?\.\(record\)/u);
  assert.match(evidence, /loadEvidenceRecord\(lookup\)/u);
  assert.match(evidence, /setSelected\(record\)/u);
  assert.doesNotMatch(evidence, /record\.details\s*=/u);
});

test('v4 app links investigation board to local spatial context and TEAM with strict evidence boundaries', async () => {
  const app = await text('apps/aethergrid-console/web/src/app/App.tsx');

  assert.match(app, /selectedEvidence/u);
  assert.match(app, /<EvidencePanel onSelectEvidence=\{setSelectedEvidence\}/u);
  assert.match(app, /<SpatialInvestigationBoard/u);
  assert.match(app, /workset=\{spatialWorkset\}/u);
  assert.match(app, /incidents=\{spatialIncidents\}/u);
  assert.match(app, /geometry=\{worksetGeometry\}/u);
  assert.match(app, /selectedEvidence=\{selectedEvidence\}/u);
  assert.match(app, /const analyzeSpatialInvestigation/u);
  assert.match(app, /agent: 'TEAM'/u);
  assert.match(app, /human-entered analytical judgment/u);
  assert.match(app, /not a verified finding/u);
  assert.match(app, /must be inspected independently/u);
  assert.match(app, /Separate confirmed observations from assumptions, contradictions, uncertainty and missing evidence/u);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);
async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 D-Wave client uses the merged server routes and never transports credentials', async () => {
  const client = await text('apps/aethergrid-console/web/src/services/quantum-client.ts');

  assert.match(client, /\/api\/aethergrid\/quantum\/dwave\/solvers/u);
  assert.match(client, /\/api\/aethergrid\/quantum\/dwave\/jobs/u);
  assert.match(client, /confirmSubmission: true/u);
  assert.match(client, /solver: input\.solver/u);
  assert.match(client, /problemType: input\.problemType/u);
  assert.match(client, /problemPayload: input\.problemPayload/u);
  assert.match(client, /loadDwaveResult/u);
  assert.doesNotMatch(client, /AETHERGRID_DWAVE_API_TOKEN|X-Sapi-Token/u);
});

test('v4 D-Wave operator workspace requires two explicit confirmation boundaries', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/QuantumPanel.tsx');

  assert.match(panel, /ANNEAL \/ D-WAVE/u);
  assert.match(panel, /ENCODED PROBLEM DATA/u);
  assert.match(panel, /dwaveConfirmed/u);
  assert.match(panel, /No job is sent until I press submit/u);
  assert.match(panel, /globalThis\.confirm/u);
  assert.match(panel, /submitDwaveJob/u);
  assert.match(panel, /confirmSubmission: true/u);
  assert.match(panel, /SUBMIT CONFIRMED D-WAVE PROBLEM/u);
  assert.match(panel, /may consume provider quota/u);
  assert.doesNotMatch(panel, /setInterval\([^)]*submitDwaveJob/u);
});

test('v4 D-Wave workspace distinguishes submitted hardware from executed hardware', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/QuantumPanel.tsx');

  assert.match(panel, /if \(job\.hardwareExecuted\) return 'HARDWARE EXECUTED'/u);
  assert.match(panel, /if \(job\.hardwareSubmitted\) return 'HARDWARE SUBMITTED'/u);
  assert.match(panel, /loadDwaveJob/u);
  assert.match(panel, /next\.status === 'COMPLETED'/u);
  assert.match(panel, /loadDwaveResult/u);
  assert.match(panel, /setDwaveResult\(resultEnvelope\.data\.result \?\? null\)/u);
  assert.match(panel, /does not synthesize an annealing result/u);
  assert.match(panel, /provider returns a completed answer/u);
});

test('v4 D-Wave workspace validates source payloads locally but sends them unchanged', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/QuantumPanel.tsx');

  assert.match(panel, /parseJsonObject/u);
  assert.match(panel, /Problem payload cannot be empty/u);
  assert.match(panel, /Invalid JSON/u);
  assert.match(panel, /problemPayload: parsedProblem\.value/u);
  assert.match(panel, /parameters: parsedParameters\.value/u);
  assert.match(panel, /sent unchanged as the provider problem payload/u);
});

test('v4 D-Wave workspace has dedicated compact operator styling', async () => {
  const styles = await text('apps/aethergrid-console/web/src/app/app.css');

  assert.match(styles, /\.quantum-workspace-tabs/u);
  assert.match(styles, /\.dwave-workspace/u);
  assert.match(styles, /\.dwave-json-field/u);
  assert.match(styles, /\.dwave-confirmation/u);
  assert.match(styles, /\.dwave-result/u);
});


test('v4 D-Wave discovery failure does not block IBM or local gate-model startup', async () => {
  const panel = await text('apps/aethergrid-console/web/src/components/QuantumPanel.tsx');

  assert.match(panel, /Promise\.all\(\[\s*loadQuantumRuntime\(\),\s*loadQuantumBackends\(\),\s*loadQuantumJobs\(\)\s*\]\)/u);
  assert.match(panel, /void loadDwaveSolvers\(\)/u);
  assert.match(panel, /setDwaveError/u);
  assert.doesNotMatch(
    panel,
    /Promise\.all\(\[[\s\S]{0,220}loadDwaveSolvers\(\)[\s\S]{0,120}\]\)/u
  );
});

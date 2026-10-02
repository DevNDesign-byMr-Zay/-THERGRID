import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = new URL('../.github/workflows/aethergrid-live-provider-smoke.yml', import.meta.url);
const script = new URL('../scripts/aethergrid-live-provider-smoke.mjs', import.meta.url);

test('live-provider smoke workflow is manual and read-only for quantum hardware', async () => {
  const [workflowSource, scriptSource] = await Promise.all([
    readFile(workflow, 'utf8'),
    readFile(script, 'utf8'),
  ]);

  assert.match(workflowSource, /workflow_dispatch:/u);
  assert.doesNotMatch(workflowSource, /\npush:/u);
  assert.doesNotMatch(workflowSource, /\npull_request:/u);
  assert.match(workflowSource, /actions\/upload-artifact@v4/u);

  assert.match(scriptSource, /runtime\.listBackends\(\)/u);
  assert.match(scriptSource, /action: 'discover'/u);
  assert.doesNotMatch(scriptSource, /submitSampler\(/u);
  assert.doesNotMatch(scriptSource, /submitEstimator\(/u);
  assert.doesNotMatch(scriptSource, /action: 'submit'/u);
  assert.match(scriptSource, /hardwareSubmitted: false/u);
  assert.match(scriptSource, /hardwareExecuted: false/u);
});

test('live-provider smoke report is intentionally sanitized', async () => {
  const source = await readFile(script, 'utf8');

  assert.doesNotMatch(source, /apiKey:\s*process\.env/u);
  assert.doesNotMatch(source, /token:\s*process\.env/u);
  assert.match(source, /schemaVersion: 1/u);
  assert.match(source, /live-response-verified/u);
  assert.match(source, /not-configured/u);
  assert.match(source, /state: 'failed'/u);
});

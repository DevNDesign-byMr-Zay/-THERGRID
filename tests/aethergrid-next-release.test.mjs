import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');

test('new security and reproducibility milestone has a unique, aligned v0.3.3 candidate', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  const consoleManifest = JSON.parse(await read('apps/operator-console/app.json'));
  const request = (await read('docs/releases/v0.3.3.request')).trim();
  const workflow = await read('.github/workflows/release-request-v0.3.3.yml');

  assert.equal(manifest.version, '0.3.3');
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[''].version, manifest.version);
  assert.equal(consoleManifest.version, manifest.version);
  assert.equal(request, `v${manifest.version}`);
  assert.match(workflow, /workflows: \['aethergrid\/canonical-live'\]/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /gh workflow run release\.yml --ref main --field tag=v0\.3\.3/);
});

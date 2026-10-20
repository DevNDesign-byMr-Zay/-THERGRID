import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const file = (path) => readFile(new URL(path, ROOT), 'utf8');

test('Node tests retain their blocking coverage contract and emit independent machine-readable results', async () => {
  const [packageJson, engineeringCi] = await Promise.all([
    file('package.json').then(JSON.parse),
    file('.github/workflows/ci.yml'),
  ]);

  const scripts = packageJson.scripts;
  assert.match(scripts.test, /node --test tests\/\*\.test\.mjs tests\/\*\*\/\*\.test\.mjs/u);
  assert.match(scripts.coverage, /--test-coverage-lines=84/u);
  assert.match(scripts.coverage, /--test-coverage-branches=70/u);
  assert.match(scripts.coverage, /--test-coverage-functions=85/u);
  assert.match(scripts.coverage, /tests\/\*\.test\.mjs tests\/\*\*\/\*\.test\.mjs/u);

  assert.match(scripts['pretest:report'], /mkdirSync\('test-results'/u);
  const report = scripts['test:report'];
  assert.match(report, /--test-reporter=spec/u);
  assert.match(report, /--test-reporter=junit/u);
  assert.match(report, /--test-reporter-destination=test-results\/node-tests\.xml/u);
  assert.match(report, /tests\/\*\.test\.mjs tests\/\*\*\/\*\.test\.mjs/u);
  assert.doesNotMatch(report, /test-skip-pattern|test-name-pattern|--test-only/u);

  assert.match(engineeringCi, /npm run test:report/u);
  assert.match(engineeringCi, /name: node-test-results/u);
  assert.match(engineeringCi, /path: test-results\/node-tests\.xml/u);
  assert.match(engineeringCi, /if-no-files-found: error/u);
  assert.match(engineeringCi, /npm run coverage/u);
  assert.match(engineeringCi, /NODE_V8_COVERAGE:\s*coverage\/v8/u);
});

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const moduleUrl = new URL('../scripts/lib/environment-coverage.mjs', import.meta.url);

test('both repository templates document every maintained source environment access', async () => {
  const { auditEnvironmentTemplates } = await import(moduleUrl);
  const result = await auditEnvironmentTemplates();
  assert.ok(result.keys.size >= 90);
  assert.deepEqual(result.missing, []);
});

test('environment discovery reads actual access expressions, including brackets and destructuring', async () => {
  const { sourceEnvironmentKeys } = await import(moduleUrl);
  const source = `
    // process.env.COMMENT_ONLY
    const example = 'process.env.STRING_ONLY';
    const a = process.env.NODE_ENV;
    const b = process.env['NODE_OPTIONS'];
    const c = env.AETHERGRID_PORT;
    const { AETHERGRID_TEST_CANONICAL: canonical, CI } = process.env;
    const token = import.meta.env.VITE_AETHERGRID_CESIUM_ION_TOKEN;
  `;
  assert.deepEqual([...sourceEnvironmentKeys(source)].sort(), [
    'AETHERGRID_PORT',
    'AETHERGRID_TEST_CANONICAL',
    'CI',
    'NODE_ENV',
    'NODE_OPTIONS',
    'VITE_AETHERGRID_CESIUM_ION_TOKEN',
  ]);
});

test('environment audit includes nested web configs and scripts, and identifies each missing template key', async () => {
  const { auditEnvironmentTemplates } = await import(moduleUrl);
  const directory = await mkdtemp(join(tmpdir(), 'aethergrid-env-audit-'));
  try {
    for (const folder of [
      'src',
      'scripts',
      'apps/aethergrid-console/web/node_modules',
      'apps/aethergrid-console/web/tests',
    ]) {
      await mkdir(join(directory, folder), { recursive: true });
    }
    await writeFile(join(directory, 'src/runtime.mjs'), 'process.env.NODE_ENV;');
    await writeFile(join(directory, 'scripts/report.mjs'), 'process.env.AETHERGRID_JUNIT_PATH;');
    await writeFile(
      join(directory, 'apps/aethergrid-console/web/playwright.config.ts'),
      'process.env.AETHERGRID_TEST_CANONICAL;',
    );
    await writeFile(
      join(directory, 'apps/aethergrid-console/web/tests/local.spec.ts'),
      'process.env.AETHERGRID_LOCAL_HTML;',
    );
    await writeFile(
      join(directory, 'apps/aethergrid-console/web/node_modules/vendor.js'),
      'process.env.VENDOR_ONLY;',
    );
    for (const file of ['.env.example', 'apps/aethergrid-console/.env.example']) {
      await writeFile(join(directory, file), 'NODE_ENV=\nAETHERGRID_JUNIT_PATH=\n');
    }
    const root = pathToFileURL(`${directory}/`);
    const result = await auditEnvironmentTemplates(root);
    assert.deepEqual(result.missing.map(({ key }) => key).sort(), [
      'AETHERGRID_LOCAL_HTML',
      'AETHERGRID_LOCAL_HTML',
      'AETHERGRID_TEST_CANONICAL',
      'AETHERGRID_TEST_CANONICAL',
    ]);
    assert.equal(result.keys.has('VENDOR_ONLY'), false);
    for (const file of ['.env.example', 'apps/aethergrid-console/.env.example']) {
      await writeFile(
        join(directory, file),
        'NODE_ENV=\nAETHERGRID_JUNIT_PATH=\nAETHERGRID_TEST_CANONICAL=\nAETHERGRID_LOCAL_HTML=\n',
      );
    }
    assert.deepEqual((await auditEnvironmentTemplates(root)).missing, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

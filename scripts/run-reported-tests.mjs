import { spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const report = resolve(
  root,
  process.env.AETHERGRID_JUNIT_PATH || 'test-results/junit/root-tests.xml',
);

async function discoverTests(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await discoverTests(path)));
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(path);
    }
  }
  return files.sort();
}

const explicitlySelected = process.argv.slice(2);
const files = explicitlySelected.length
  ? explicitlySelected.map((path) => resolve(path))
  : await discoverTests(join(root, 'tests'));

if (!files.length) {
  throw new Error('No maintained Node test files discovered');
}

await mkdir(dirname(report), { recursive: true });

const args = [
  '--test',
  '--test-reporter=spec',
  '--test-reporter-destination=stdout',
  '--test-reporter=junit',
  `--test-reporter-destination=${report}`,
  ...files,
];

// Node marks child processes spawned by node:test as nested. Remove that marker
// so the reporter itself can be tested with real passing/failing fixture runners.
const cleanEnvironment = { ...process.env };
delete cleanEnvironment.NODE_TEST_CONTEXT;

const result = await new Promise((resolveResult, reject) => {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: cleanEnvironment,
    stdio: 'inherit',
  });
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    resolveResult({ code, signal });
  });
});

// A readable JUnit artifact never substitutes for a passing test process.
if (result.signal) {
  process.stderr.write(`Node test runner terminated by ${result.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.code ?? 1;
}

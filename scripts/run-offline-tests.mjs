import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const testsRoot = join(root, 'tests');
const tests = [];
for (const folder of [testsRoot, join(testsRoot, 'js')]) {
  for (const entry of await readdir(folder)) {
    if (entry.endsWith('.test.mjs')) tests.push(join(folder, entry));
  }
}
tests.sort();

const guard = fileURLToPath(new URL('./guard-offline-network.mjs', import.meta.url));
const nodeOptions = [process.env.NODE_OPTIONS || '', `--import=${guard}`].filter(Boolean).join(' ');
const env = { ...process.env, NODE_OPTIONS: nodeOptions, AETHERGRID_AI_PROVIDER: 'local' };

for (const name of Object.keys(env)) {
  if (
    /^AETHERGRID_.*(?:API_KEY|API_TOKEN|CLIENT_SECRET|CLIENT_ID|SERVICE_CRN|PASSWORD)$/u.test(name)
  ) {
    delete env[name];
  }
}

const child = spawn(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit', env });
child.once('error', (error) => {
  process.stderr.write(`Offline test runner failed: ${error.message}\n`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});

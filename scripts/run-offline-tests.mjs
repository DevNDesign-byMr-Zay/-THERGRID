import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const testsRoot = join(root, 'tests');
const tests = [];
async function discoverTests(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name === 'node_modules') continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      await discoverTests(path);
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      tests.push(path);
    }
  }
}
await discoverTests(testsRoot);
tests.sort();

const guard = new URL('./guard-offline-network.mjs', import.meta.url).href;
const nodeOptions = [process.env.NODE_OPTIONS || '', `--import=${guard}`].filter(Boolean).join(' ');
const env = { ...process.env, NODE_OPTIONS: nodeOptions, AETHERGRID_AI_PROVIDER: 'local' };

for (const name of Object.keys(env)) {
  if (
    /(?:^|_)(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIALS?|CRN|CLIENT_ID|AUTH_USERS)(?:$|_)/u.test(name)
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

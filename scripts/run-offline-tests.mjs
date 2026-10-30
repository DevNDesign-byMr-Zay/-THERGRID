import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { discoverTests } from './lib/test-discovery.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const testsRoot = join(root, 'tests');
const tests = await discoverTests(testsRoot);

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

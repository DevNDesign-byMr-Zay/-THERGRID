import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { discoverTests } from './lib/test-discovery.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = await discoverTests(join(root, 'tests'));
const child = spawn(process.execPath, ['--test', ...process.argv.slice(2), ...files], {
  cwd: root,
  stdio: 'inherit',
});
child.once('error', (error) => {
  process.stderr.write(`Node test runner failed: ${error.message}\n`);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});

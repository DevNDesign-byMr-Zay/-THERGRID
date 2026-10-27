import { spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { resolve, join, extname, basename } from 'node:path';

const ignored = new Set(['node_modules', 'dist', '.git', 'coverage', 'test-results']);
const extensions = new Set(['.mjs', '.js']);

async function collectSources(path, files) {
  const entry = await stat(path);
  if (entry.isFile()) {
    if (extensions.has(extname(path))) files.push(path);
    return;
  }
  if (!entry.isDirectory() || ignored.has(basename(path))) return;

  for (const child of await readdir(path, { withFileTypes: true })) {
    if (child.isSymbolicLink() || ignored.has(child.name)) continue;
    if (child.isDirectory() || (child.isFile() && extensions.has(extname(child.name)))) {
      await collectSources(join(path, child.name), files);
    }
  }
}

const roots = process.argv.length > 2 ? process.argv.slice(2) : ['src', 'tests', 'scripts', 'apps'];
const files = [];

try {
  for (const root of roots) await collectSources(resolve(root), files);
  files.sort();
  let failures = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      failures += 1;
      process.stderr.write(`${file}:\n${result.stderr || result.error || 'syntax check failed'}\n`);
    }
  }
  process.stdout.write(`Syntax verification: ${files.length} files checked, ${failures} errors.\n`);
  if (failures) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Syntax verification failed: ${error.message}\n`);
  process.exitCode = 1;
}

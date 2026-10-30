import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function discoverTests(folder) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.test.mjs')) files.push(path);
    }
  }
  await visit(folder);
  if (!files.length) throw new Error('No maintained Node test files discovered');
  return files.sort();
}

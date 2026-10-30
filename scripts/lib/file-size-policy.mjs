import { readFile, readdir } from 'node:fs/promises';
import ts from 'typescript';

export const MAX_CODE_LINES = 500;
const excluded = new Set([
  'node_modules',
  'dist',
  'local-dist',
  'build',
  'coverage',
  'assets',
  'artifacts',
  'test-results',
  'playwright-report',
]);

export function countCodeLines(source, filename = 'source.js') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const textLines = source.split(/\r?\n/u);
  const lines = new Set();
  function visit(node) {
    const children = node.getChildren(file);
    if (children.length) {
      children.forEach(visit);
      return;
    }
    const start = node.getStart(file);
    if (start >= node.end) return;
    const first = file.getLineAndCharacterOfPosition(start).line;
    const last = file.getLineAndCharacterOfPosition(node.end - 1).line;
    for (let line = first; line <= last; line++) {
      if (textLines[line].trim()) lines.add(line);
    }
  }
  visit(file);
  return lines.size;
}

export function fileSizeViolation(path, count, exceptions) {
  const ceiling = exceptions[path] ?? MAX_CODE_LINES;
  if (count > ceiling) return `${path}: ${count} code lines exceed ${ceiling}`;
  if (exceptions[path] && count <= MAX_CODE_LINES) return `${path}: remove retired size exception`;
  return null;
}

export async function sourceFileSizes(root = new URL('../../', import.meta.url)) {
  const sizes = new Map();
  async function scan(folder) {
    for (const entry of await readdir(new URL(folder, root), { withFileTypes: true })) {
      const path = `${folder}${entry.name}`;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !excluded.has(entry.name)) await scan(`${path}/`);
      } else if (entry.isFile() && /\.(?:js|mjs|ts|tsx|mts)$/u.test(entry.name)) {
        sizes.set(path, countCodeLines(await readFile(new URL(path, root), 'utf8'), path));
      }
    }
  }
  for (const folder of ['src/', 'apps/', 'scripts/', 'tests/']) await scan(folder);
  return sizes;
}

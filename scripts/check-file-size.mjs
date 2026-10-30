import { readFile } from 'node:fs/promises';
import { fileSizeViolation, sourceFileSizes } from './lib/file-size-policy.mjs';

const exceptions = JSON.parse(
  await readFile(new URL('../config/file-size-budgets.json', import.meta.url), 'utf8'),
);
const sizes = await sourceFileSizes();
const violations = [];
for (const [path, count] of sizes) {
  const violation = fileSizeViolation(path, count, exceptions);
  if (violation) violations.push(violation);
}
for (const path of Object.keys(exceptions)) {
  if (!sizes.has(path)) violations.push(`${path}: remove missing file size exception`);
}
if (violations.length) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `File-size policy verified across ${sizes.size} source/test modules (500-line default; bounded existing exceptions).\n`,
  );
}

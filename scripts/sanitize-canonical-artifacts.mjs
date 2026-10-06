import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { sanitizeAcceptance } from './lib/canonical-acceptance.mjs';

const directory = 'canonical-evidence';
try {
  for (const name of await readdir(directory)) {
    if (!['providers.json', 'cesium.json'].includes(name))
      throw new Error('unexpected acceptance artifact');
    const path = `${directory}/${name}`;
    const report = JSON.parse(await readFile(path, 'utf8'));
    if (report.commit !== process.env.GITHUB_SHA)
      throw new Error('acceptance artifact commit mismatch');
    await writeFile(path, `${JSON.stringify(sanitizeAcceptance(report), null, 2)}\n`);
  }
} catch {
  await rm(directory, { recursive: true, force: true });
  console.error('Canonical artifact validation failed; evidence removed before upload.');
  process.exitCode = 1;
}

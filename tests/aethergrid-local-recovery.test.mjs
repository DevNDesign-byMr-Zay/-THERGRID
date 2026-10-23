import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('offline HTML never opens dead localhost without verified local service health', async () => {
  const gate = await read('apps/aethergrid-console/web/src/components/SessionGate.tsx');
  assert.match(gate, /api\/aethergrid\/health/u);
  assert.match(gate, /health\?\.ok===true && health\?\.product==='ÆTHERGRID'/u);
  assert.match(gate, /location\.replace\('http:\/\/127\.0\.0\.1:8090\/'\)/u);
  assert.match(gate, /START-AETHERGRID\.cmd/u);
  assert.doesNotMatch(gate, /<a href="http:\/\/127\.0\.0\.1:8090">Open connected workspace<\/a>/u);
});

test('failed mapped city geometry can be retried without replacing source-backed data', async () => {
  const [app, css] = await Promise.all([
    read('apps/aethergrid-console/web/src/app/App.tsx'),
    read('apps/aethergrid-console/web/src/app/app.css'),
  ]);
  assert.match(app, /const \[cityReloadId, setCityReloadId\] = useState\(0\)/u);
  assert.match(app, /\[city\.id, city\.latitude, city\.longitude, cityReloadId\]/u);
  assert.match(app, /onClick=\{\(\) => setCityReloadId\(\(current\) => current \+ 1\)\}/u);
  assert.match(app, /RETRY 3D CITY/u);
  assert.match(app, /bundle\.identity\.sourceProvider === 'local-fallback'/u);
  assert.match(css, /\.scene-caption \.city-retry-button/u);
  assert.match(css, /pointer-events: auto/u);
});

test('standalone Cesium workers normalize Windows ids and reject late dynamic module imports', async () => {
  const [assembler, config] = await Promise.all([
    read('scripts/assemble-aethergrid-local-html.mjs'),
    read('apps/aethergrid-console/web/vite.local.config.ts'),
  ]);
  assert.match(assembler, /const normalizedId = id\.replaceAll/u);
  assert.match(assembler, /normalizedId\.endsWith\('\/Workers\/createGeometry\.js'\)/u);
  assert.match(assembler, /Unbundled geometry factory/u);
  assert.match(assembler, /output\.includes\('Unbundled geometry factory'\)/u);
  assert.match(config, /id\.replaceAll/u);
  assert.match(config, /importer\?\.replaceAll/u);
});

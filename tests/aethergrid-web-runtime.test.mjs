import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createCanonicalWebRuntime } from '../apps/aethergrid-console/web-runtime.mjs';

async function withFixture(run) {
  const appRoot = await mkdtemp(join(tmpdir(), 'aethergrid-web-'));
  const dist = join(appRoot, 'web', 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<!doctype html><div id="root">canonical</div>');
  await writeFile(join(dist, 'assets', 'app.js'), 'globalThis.__aethergrid = true;');

  const runtime = createCanonicalWebRuntime({ appRoot });
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    await runtime.serve(request, response, url);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(appRoot, { recursive: true, force: true });
  }
}

test('canonical web runtime serves index, static assets and SPA fallback', async () => {
  await withFixture(async (baseUrl) => {
    const root = await fetch(`${baseUrl}/`);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /id="root"/u);

    const asset = await fetch(`${baseUrl}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/u);

    const route = await fetch(`${baseUrl}/global/new-york`);
    assert.equal(route.status, 200);
    assert.match(await route.text(), /canonical/u);

    const missingAsset = await fetch(`${baseUrl}/assets/missing.js`);
    assert.equal(missingAsset.status, 404);
  });
});

test('canonical web runtime never turns API or private-file requests into SPA routes', async () => {
  await withFixture(async (baseUrl) => {
    const api = await fetch(`${baseUrl}/api/aethergrid/missing`);
    assert.equal(api.status, 404);
    assert.equal((await api.json()).error, 'not_found');

    const env = await fetch(`${baseUrl}/.env`);
    assert.equal(env.status, 403);
    assert.equal((await env.json()).error, 'forbidden');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bootstrapLegacyPage } from './helpers/legacy-script-bootstrap.mjs';

const appRoot = new URL('../apps/aethergrid-console/', import.meta.url);
const readAsset = (name) => readFile(new URL(name, appRoot), 'utf8');
const html = await readAsset('index.html');

function assertBootstrapped({ context, nodes, listeners, contexts }) {
  assert.equal(typeof context.AETHERGRID_CITY_BUILDINGS?.buildCityBuildings, 'function');
  assert.equal(typeof context.AETHERGRID_LEGACY_VISUALIZERS, 'function');
  assert.equal(context.document.body.dataset.workspace, 'grid');
  assert.equal(nodes.get('#streamReadout').textContent, 'LOCAL 4D SIM');
  assert.match(nodes.get('#globalSolarStatus').textContent, /^SUN .+ · TERMINATOR LIVE$/u);
  assert.ok(listeners.length > 20);
  assert.ok(contexts.includes('webgl'));
}

test('complete normal classic-script bootstrap reaches offline workspace with no WebGL', async () => {
  const result = await bootstrapLegacyPage(html, readAsset);
  assertBootstrapped(result);
  assert.deepEqual(result.scripts, [
    'state.js',
    'standalone-geo.js',
    'spatial-math.js',
    'legacy-city-buildings.js',
    'legacy-globe-core.js',
    'legacy-visualizers.js',
    'settings-controller.js',
    'environment-helpers.js',
    'app.js',
  ]);
});

test('complete source-inlined classic-script bootstrap reaches offline workspace with no WebGL', async () => {
  let inlineHtml = html;
  for (const match of html.matchAll(/<script src="\.\/([^"]+)" defer><\/script>/gu)) {
    inlineHtml = inlineHtml.replace(match[0], `<script>\n${await readAsset(match[1])}\n</script>`);
  }
  const result = await bootstrapLegacyPage(inlineHtml, () => {
    throw new Error('fully inline bootstrap must not load an external script');
  });
  assertBootstrapped(result);
  assert.deepEqual(result.scripts, Array(9).fill('inline'));
});

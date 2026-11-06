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
    'legacy-ui-helpers.js',
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
  assert.deepEqual(result.scripts, Array(10).fill('inline'));
});

test('legacy feedback escapes toast text and preserves dialog labels and dismissal', async () => {
  const { runInNewContext } = await import('node:vm');
  const elements = new Map();
  const dialog = {
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
  elements.set('#panelDialog', dialog);
  for (const id of ['#dialogKicker', '#dialogTitle', '#dialogBody', '#toast']) elements.set(id, {});
  const active = new Set();
  elements.get('#toast').classList = {
    add: (name) => active.add(name),
    remove: (name) => active.delete(name),
  };
  const closeButton = {
    addEventListener(event, listener) {
      assert.equal(event, 'click');
      this.click = listener;
    },
    closest(selector) {
      assert.equal(selector, 'dialog');
      return dialog;
    },
  };
  let nextTimer = 0;
  const timers = new Map();
  const context = {
    setTimeout(callback) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  runInNewContext(await readAsset('legacy-ui-helpers.js'), context);
  const feedback = context.AETHERGRID_LEGACY_UI.createFeedback({
    querySelector: (selector) => elements.get(selector),
    querySelectorAll: () => [closeButton],
  });
  feedback.showToast('<img>', '& "');
  assert.equal(elements.get('#toast').innerHTML, '<b>&lt;img&gt;</b><small>&amp; &quot;</small>');
  assert.ok(active.has('show'));
  feedback.showToast('next', 'toast');
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(active.has('show'), false);
  feedback.openPanel('Panel', '<title>', '<p>Trusted app markup</p>');
  assert.equal(elements.get('#dialogTitle').textContent, '<title>');
  assert.equal(elements.get('#dialogBody').innerHTML, '<p>Trusted app markup</p>');
  assert.equal(dialog.open, true);
  closeButton.click();
  assert.equal(dialog.open, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

await import('../apps/aethergrid-console/state.js');

const { SETTINGS_KEY, DEFAULT_GLOBAL_CITIES, defaultSettings, createState } =
  globalThis.AETHERGRID_LEGACY_STATE;

test('legacy state initializes advisory-only and uses distinct independent workspaces', () => {
  const first = createState();
  const second = createState();
  assert.notEqual(first, second);
  assert.equal(first.system.mode, 'ADVISORY ONLY');
  assert.equal(first.workspace, 'grid');
  assert.equal(first.selectedAgent, 'TEAM');
  assert.equal(first.geospatial.selectedCityId, 'new-york');
  assert.equal(first.geospatial.cities.length, 8);
  first.settings.theme = 'light';
  first.agentChats.TEAM.push({ role: 'operator', content: 'fixture' });
  first.geospatial.cities[0].name = 'Test City';
  assert.equal(second.settings.theme, 'dark');
  assert.deepEqual(second.agentChats.TEAM, []);
  assert.equal(second.geospatial.cities[0].name, 'New York');
});

test('legacy settings retain validated immutable defaults and expected storage identity', () => {
  assert.equal(SETTINGS_KEY, 'aethergrid.operator.settings.v2');
  assert.ok(Object.isFrozen(defaultSettings));
  assert.ok(Object.isFrozen(DEFAULT_GLOBAL_CITIES));
  assert.equal(defaultSettings.refreshMs, 2500);
  assert.equal(defaultSettings.defaultHour, 12);
  assert.equal(defaultSettings.spatialLabels, true);
  assert.deepEqual(createState().settings, { ...defaultSettings });
});

test('legacy HTML loads state before application without ES modules', async () => {
  const html = await readFile(
    new URL('../apps/aethergrid-console/index.html', import.meta.url),
    'utf8',
  );
  const stateScript = '<script src="./state.js" defer></script>';
  const appScript = '<script src="./app.js" defer></script>';
  assert.ok(html.includes(stateScript));
  assert.ok(html.includes(appScript));
  assert.ok(html.indexOf(stateScript) < html.indexOf(appScript));
  assert.doesNotMatch(html, /type="module"/u);
});

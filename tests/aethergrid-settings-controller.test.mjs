import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

async function controller() {
  const context = {};
  runInNewContext(
    await readFile(
      new URL('../apps/aethergrid-console/settings-controller.js', import.meta.url),
      'utf8',
    ),
    context,
  );
  return context.AETHERGRID_SETTINGS_CONTROLLER;
}

test('settings load merges defaults without mutating them and survives malformed or unavailable storage', async () => {
  const { loadSettings } = await controller();
  const defaults = Object.freeze({ theme: 'dark', density: 'comfortable' });
  const stored = { getItem: () => '{"theme":"light"}' };
  assert.equal(loadSettings(stored, 'preferences', defaults).theme, 'light');
  assert.equal(loadSettings(stored, 'preferences', defaults).density, 'comfortable');
  assert.equal(defaults.theme, 'dark');
  for (const storage of [
    { getItem: () => '{invalid' },
    {
      getItem() {
        throw Error('denied');
      },
    },
  ]) {
    assert.equal(loadSettings(storage, 'preferences', defaults).theme, 'dark');
  }
});

test('settings save writes only the provided key and preserves write failures', async () => {
  const { saveSettings } = await controller();
  const writes = [];
  saveSettings({ setItem: (...args) => writes.push(args) }, 'operator', { theme: 'light' });
  assert.deepEqual(writes, [['operator', '{"theme":"light"}']]);
  assert.throws(
    () =>
      saveSettings(
        {
          setItem() {
            throw Error('quota');
          },
        },
        'operator',
        {},
      ),
    /quota/u,
  );
});

test('settings presentation resolves system theme, motion, labels and field values without DOM access', async () => {
  const { applySettings, resolvedTheme } = await controller();
  const settings = {
    theme: 'system',
    density: 'compact',
    spatialLabels: false,
    reducedMotion: false,
    animationIntensity: 0,
    refreshMs: 2500,
    defaultHour: 12,
  };
  const view = applySettings(settings, true);
  assert.equal(view.theme, 'light');
  assert.equal(view.density, 'compact');
  assert.equal(view.motion, 'reduced');
  assert.equal(view.spatialLabels, 'off');
  assert.equal(view.animationScale, '0');
  assert.equal(view.bindings.settingRefresh, '2500');
  assert.equal(view.bindings.settingHour, 12);
  assert.equal(resolvedTheme('system', false), 'dark');
  assert.equal(resolvedTheme('light', false), 'light');
  assert.equal(resolvedTheme('unknown', true), 'dark');
  assert.equal(
    applySettings({ ...settings, animationIntensity: 50, reducedMotion: true }).motion,
    'reduced',
  );
  assert.equal(
    applySettings({ ...settings, animationIntensity: 50, spatialLabels: true }).motion,
    'full',
  );
});

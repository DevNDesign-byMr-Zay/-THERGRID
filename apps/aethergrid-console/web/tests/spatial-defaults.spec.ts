import { expect, test } from '@playwright/test';
import { CITY_TARGETS, INITIAL_LAYERS, VISUAL_MODES } from '../src/app/spatial-defaults';

test('canonical city camera presets retain real world positions and stable identities', () => {
  expect(CITY_TARGETS.map((city) => city.id)).toEqual([
    'new-york', 'london', 'tokyo', 'dubai',
    'singapore', 'sao-paulo', 'lagos', 'sydney'
  ]);
  expect(new Set(CITY_TARGETS.map((city) => city.id)).size).toBe(CITY_TARGETS.length);
  for (const city of CITY_TARGETS) {
    expect(city.name.trim()).not.toBe('');
    expect(city.district.trim()).not.toBe('');
    expect(Number.isFinite(city.latitude)).toBe(true);
    expect(Number.isFinite(city.longitude)).toBe(true);
    expect(Math.abs(city.latitude)).toBeLessThanOrEqual(90);
    expect(Math.abs(city.longitude)).toBeLessThanOrEqual(180);
    expect(city.rangeMeters).toBeGreaterThan(0);
    expect(city.heightMeters).toBeGreaterThan(0);
  }
});

test('spatial shell exposes unique real layer controls and renderer visual modes', () => {
  expect(new Set(INITIAL_LAYERS.map((layer) => layer.id)).size).toBe(INITIAL_LAYERS.length);
  expect(INITIAL_LAYERS.every((layer) => layer.visible === true)).toBe(true);
  for (const id of ['terrain', 'buildings', 'roads', 'grid', 'weather', 'hydrology', 'energy']) {
    expect(INITIAL_LAYERS.some((layer) => layer.id === id)).toBe(true);
  }
  expect(VISUAL_MODES).toEqual([
    'solid', 'wireframe', 'grid', 'xray', 'holographic', 'operations', 'reality'
  ]);
});

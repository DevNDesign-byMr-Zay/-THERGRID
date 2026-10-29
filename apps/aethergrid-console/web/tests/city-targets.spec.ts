import { expect, test } from '@playwright/test';
import {
  CITY_TARGETS,
  INITIAL_LAYERS,
  VISUAL_MODES,
  resolveCityTarget
} from '../src/app/city-targets';

test('named-city search preserves configured identity and partial district matching', () => {
  expect(CITY_TARGETS).toHaveLength(8);
  expect(resolveCityTarget('  new york  ')).toEqual(CITY_TARGETS[0]);
  expect(resolveCityTarget('south bank')).toMatchObject({ id: 'london', longitude: -0.0917 });
  expect(resolveCityTarget('são')).toMatchObject({ id: 'sao-paulo', latitude: -23.5614 });
  expect(resolveCityTarget('MARINA')).toMatchObject({ id: 'singapore', name: 'SINGAPORE' });
});

test('coordinate search preserves fixed-precision target identity and view defaults', () => {
  expect(resolveCityTarget('40.123456, -73.987654')).toEqual({
    id: 'coord-40.12346--73.98765',
    name: 'COORDINATE',
    district: '40.12346°, -73.98765°',
    latitude: 40.123456,
    longitude: -73.987654,
    rangeMeters: 5_200,
    pitchDegrees: -35,
    custom: true
  });
  expect(resolveCityTarget('90 180')).toMatchObject({ latitude: 90, longitude: 180 });
  expect(resolveCityTarget('-90,-180')).toMatchObject({ latitude: -90, longitude: -180 });
});

test('search rejects malformed, unsupported and out-of-range coordinates', () => {
  for (const input of ['', '   ', 'Atlantis', '91,0', '0,-181', '1e3,2', 'NaN,0', '40,', '40 50 60']) {
    expect(resolveCityTarget(input), input).toBeNull();
  }
});

test('default layers retain visible source groups and all seven renderer modes', () => {
  expect(INITIAL_LAYERS.find(layer => layer.id === 'weather-radar')).toEqual({
    id: 'weather-radar', visible: true, opacity: 0.68
  });
  expect(INITIAL_LAYERS.filter(layer => !layer.visible)).toHaveLength(0);
  expect(VISUAL_MODES).toEqual([
    'solid', 'wireframe', 'grid', 'xray', 'holographic', 'operations', 'reality'
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  seededFallback,
  fallbackRoads,
  fallbackPower
} from '../apps/aethergrid-console/geo-fallback.mjs';
import {
  heightProfile,
  numericMinHeight,
  numericRoofHeight,
  roofHeightSource,
  numericVoltage
} from '../apps/aethergrid-console/geo-metrics.mjs';

const city = Object.freeze({ id: 'new-york' });

test('synthetic building footprints are stable per city and never look like observed heights', () => {
  const buildings = seededFallback(city, 5);
  assert.deepEqual(buildings, seededFallback(city, 5));
  assert.notDeepEqual(buildings, seededFallback({ id: 'london' }, 5));
  assert.equal(buildings.length, 5);
  assert.equal(new Set(buildings.map((item) => item.id)).size, 5);
  for (const item of buildings) {
    assert.equal(item.heightSource, 'synthetic-fallback');
    assert.ok(item.heightM >= 10 && item.heightM <= 105);
    assert.equal(item.footprint.length, 5);
    assert.deepEqual(item.footprint[0], item.footprint.at(-1));
    assert.ok(item.footprint.flat().every(Number.isFinite));
  }
  assert.deepEqual(seededFallback(city, 0), []);
});

test('synthetic roads are deterministic and independent from building generation', () => {
  const roads = fallbackRoads(city, 6);
  assert.deepEqual(roads, fallbackRoads(city, 6));
  assert.notDeepEqual(roads, fallbackRoads({ id: 'tokyo' }, 6));
  assert.equal(roads.length, 6);
  for (const [index, road] of roads.entries()) {
    assert.equal(road.id, `fallback-road-${index + 1}`);
    assert.equal(road.path.length, 4);
    assert.ok(road.path.every((point) => point.length === 2 && point.every(Number.isFinite)));
    assert.equal(road.highwayType, index % 5 === 0 ? 'primary' : 'residential');
  }
});

test('synthetic power networks keep bounded, separate asset and line identities', () => {
  const power = fallbackPower(city);
  assert.deepEqual(power, fallbackPower(city));
  assert.notDeepEqual(power, fallbackPower({ id: 'sydney' }));
  assert.equal(power.powerAssets.length, 9);
  assert.equal(power.powerLines.length, 8);
  assert.equal(new Set(power.powerAssets.map((item) => item.id)).size, 9);
  assert.equal(new Set(power.powerLines.map((item) => item.id)).size, 8);
  assert.ok(power.powerAssets.every((asset) =>
    asset.position.length === 2 && asset.position.every(Number.isFinite)
  ));
  assert.ok(power.powerLines.every((line) =>
    line.path.length === 4 && line.path.flat().every(Number.isFinite)
  ));
});

test('real OSM height tags retain source priority and metric/imperial conversion', () => {
  const explicit = heightProfile({ height: '100 ft', 'building:levels': '99' });
  assert.equal(explicit.source, 'height');
  assert.ok(Math.abs(explicit.heightM - 30.48) < 1e-10);
  assert.deepEqual(heightProfile({ est_height: '25,5' }), { heightM: 25.5, source: 'est_height' });
  assert.deepEqual(heightProfile({ 'building:levels': '10' }), { heightM: 32, source: 'building:levels' });
  assert.deepEqual(heightProfile({ height: '5000' }), { heightM: 1200, source: 'height' });
  const missing = heightProfile({ height: 'not-a-number' }, 'fixed-building-id');
  assert.equal(missing.source, 'inferred');
  assert.deepEqual(missing, heightProfile({}, 'fixed-building-id'));
});

test('OSM roof and floor elevation calculations preserve source provenance', () => {
  assert.ok(Math.abs(numericMinHeight({ min_height: '10 ft' }) - 3.048) < 1e-10);
  assert.equal(numericMinHeight({ 'building:min_level': '3' }), 9.600000000000001);
  assert.equal(numericMinHeight({}), 0);
  assert.equal(numericRoofHeight({ 'roof:height': '5 m' }), 5);
  assert.equal(numericRoofHeight({ 'roof:levels': '2' }), 6.4);
  assert.equal(roofHeightSource({ 'roof:height': '5 m' }), 'roof:height');
  assert.equal(roofHeightSource({ 'roof:levels': '2' }), 'roof:levels');
  assert.equal(roofHeightSource({}), 'inferred');
});

test('power voltages remain numeric and unknown provider values remain unavailable', () => {
  assert.equal(numericVoltage('33 000;138000'), 138000);
  assert.equal(numericVoltage('220 kV;110000'), 110000);
  assert.equal(numericVoltage('unknown'), null);
  assert.equal(numericVoltage(null), null);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fallbackPower,
  fallbackRoads,
  seededFallback,
} from '../apps/aethergrid-console/geo-fallback.mjs';
import {
  heightProfile,
  numericMinHeight,
  numericRoofHeight,
  numericVoltage,
  roofHeightSource,
} from '../apps/aethergrid-console/geo-metrics.mjs';

const city = Object.freeze({ id: 'new-york' });

test('synthetic buildings are reproducible and explicitly marked as fallback', () => {
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

test('synthetic roads are deterministic and separate from building geometry', () => {
  const roads = fallbackRoads(city, 6);
  assert.deepEqual(roads, fallbackRoads(city, 6));
  assert.notDeepEqual(roads, fallbackRoads({ id: 'tokyo' }, 6));
  assert.equal(roads.length, 6);
  for (const [index, road] of roads.entries()) {
    assert.equal(road.id, `fallback-road-${index + 1}`);
    assert.equal(road.path.length, 4);
    for (const point of road.path) {
      assert.equal(point.length, 2);
      assert.ok(point.every(Number.isFinite));
    }
    assert.equal(road.highwayType, index % 5 === 0 ? 'primary' : 'residential');
  }
});

test('synthetic power has deterministic asset and line identities', () => {
  const power = fallbackPower(city);
  assert.deepEqual(power, fallbackPower(city));
  assert.notDeepEqual(power, fallbackPower({ id: 'sydney' }));
  assert.equal(power.powerAssets.length, 9);
  assert.equal(power.powerLines.length, 8);
  assert.equal(new Set(power.powerAssets.map((item) => item.id)).size, 9);
  assert.equal(new Set(power.powerLines.map((item) => item.id)).size, 8);
  for (const asset of power.powerAssets) {
    assert.equal(asset.position.length, 2);
    assert.ok(asset.position.every(Number.isFinite));
  }
  for (const line of power.powerLines) {
    assert.equal(line.path.length, 4);
    assert.ok(line.path.flat().every(Number.isFinite));
  }
});

test('real OSM heights prioritize explicit tags and convert imperial measurements', () => {
  const explicit = heightProfile({ height: '100 ft', 'building:levels': '99' });
  assert.equal(explicit.source, 'height');
  assert.ok(Math.abs(explicit.heightM - 30.48) < 1e-10);
  const estimated = heightProfile({ est_height: '25,5' });
  assert.equal(estimated.heightM, 25.5);
  assert.equal(estimated.source, 'est_height');
  const byLevels = heightProfile({ 'building:levels': '10' });
  assert.equal(byLevels.heightM, 32);
  assert.equal(byLevels.source, 'building:levels');
  assert.equal(heightProfile({ height: '5000' }).heightM, 1200);
  const missing = heightProfile({ height: 'not-a-number' }, 'fixed-building-id');
  assert.equal(missing.source, 'inferred');
  assert.deepEqual(missing, heightProfile({}, 'fixed-building-id'));
});

test('OSM floor and roof measurements retain source semantics', () => {
  assert.ok(Math.abs(numericMinHeight({ min_height: '10 ft' }) - 3.048) < 1e-10);
  assert.equal(numericMinHeight({ 'building:min_level': '3' }), 9.600000000000001);
  assert.equal(numericMinHeight({}), 0);
  assert.equal(numericRoofHeight({ 'roof:height': '5 m' }), 5);
  assert.equal(numericRoofHeight({ 'roof:levels': '2' }), 6.4);
  assert.equal(roofHeightSource({ 'roof:height': '5 m' }), 'roof:height');
  assert.equal(roofHeightSource({ 'roof:levels': '2' }), 'roof:levels');
  assert.equal(roofHeightSource({}), 'inferred');
});

test('power voltage parsing preserves the maximum and represents unknown as null', () => {
  assert.equal(numericVoltage('33 000;138000'), 138000);
  assert.equal(numericVoltage('220 kV;110000'), 110000);
  assert.equal(numericVoltage('unknown'), null);
  assert.equal(numericVoltage(null), null);
});

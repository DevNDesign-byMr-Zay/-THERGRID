import assert from 'node:assert/strict';
import test from 'node:test';
import { buildingPolygons } from '../apps/aethergrid-console/building-rings.mjs';

const ring = (x, y, size) =>
  [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ].map(([lon, lat]) => ({ lon, lat }));
const outer = ring(0, 0, 10),
  inner = ring(2, 2, 2),
  other = ring(20, 20, 10);
const way = (role, geometry) => ({ type: 'way', role, geometry });

test('multipolygon fragments stitch in either direction and assign courtyards to their own outer', () => {
  const result = buildingPolygons({
    type: 'relation',
    members: [
      way('outer', outer.slice(0, 3)),
      way('outer', outer.slice(2).reverse()),
      way('outer', other),
      way('inner', inner),
    ],
  });
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].outer, outer);
  assert.deepEqual(result[0].holes, [inner]);
  assert.deepEqual(result[1].holes, []);
});

test('unclosed, missing, ambiguous and unowned inner boundaries withhold relation geometry', () => {
  for (const members of [
    [way('outer', outer.slice(0, 3))],
    [way('outer', outer), way('inner', inner.slice(0, 3))],
    [way('outer', outer), way('inner', other)],
    [way('outer', outer), way('inner', undefined)],
    [way('outer', outer), way('inner', inner), way('inner', inner)],
  ])
    assert.deepEqual(buildingPolygons({ type: 'relation', members }), []);
});

test('ordinary closed building ways retain their geographic ring', () => {
  assert.deepEqual(buildingPolygons({ type: 'way', geometry: outer }), [{ outer, holes: [] }]);
  assert.deepEqual(buildingPolygons({ type: 'way', geometry: outer.slice(0, -1) }), []);
});

test('both OSM adapters preserve courtyard topology and suppress duplicate relation member buildings', async () => {
  const { createGeoRuntime } = await import('../apps/aethergrid-console/geo-runtime.mjs');
  const outline = ring(-73.984, 40.754, 0.001),
    court = ring(-73.9838, 40.7542, 0.0002);
  const buildings = Array.from({ length: 6 }, (_, i) => ({
    type: 'way',
    id: i + 1,
    tags: { building: 'yes', height: '30' },
    geometry: ring(-73.98 + i * 0.001, 40.75, 0.0001),
  }));
  const elements = [
    ...buildings,
    { type: 'way', id: 100, tags: { building: 'yes' }, geometry: outline },
    { type: 'way', id: 101, tags: {}, geometry: court },
    {
      type: 'relation',
      id: 200,
      tags: { building: 'yes', height: '45', type: 'multipolygon' },
      members: [
        { ...way('outer', outline), ref: 100 },
        { ...way('inner', court), ref: 101 },
      ],
    },
  ];
  let nextNode = 1;
  const nodes = [],
    ways = [];
  for (const element of elements.filter((e) => e.type === 'way')) {
    const refs = element.geometry.slice(0, -1).map((p) => {
      const id = nextNode++;
      nodes.push(`<node id="${id}" lat="${p.lat}" lon="${p.lon}"/>`);
      return id;
    });
    refs.push(refs[0]);
    ways.push(
      `<way id="${element.id}">${refs.map((id) => `<nd ref="${id}"/>`).join('')}${Object.entries(
        element.tags,
      )
        .map(([k, v]) => `<tag k="${k}" v="${v}"/>`)
        .join('')}</way>`,
    );
  }
  const xml = `<osm>${nodes.join('')}${ways.join('')}<relation id="200"><member type="way" ref="100" role="outer"/><member type="way" ref="101" role="inner"/><tag k="building" v="yes"/><tag k="height" v="45"/><tag k="type" v="multipolygon"/></relation></osm>`;
  for (const mapApi of [false, true]) {
    const runtime = createGeoRuntime({
      env: {
        AETHERGRID_GEO_PROVIDER: 'osm-overpass',
        AETHERGRID_OVERPASS_URL: 'https://fixture.test/overpass',
      },
      fetchImpl: async (url) =>
        String(url).includes('overpass')
          ? mapApi
            ? new Response('', { status: 503 })
            : Response.json({ elements })
          : new Response(xml, { headers: { 'content-type': 'application/xml' } }),
    });
    const mesh = await runtime.cityMesh('new-york');
    const relation = mesh.buildings.find((b) => b.osmId === 200);
    assert.ok(relation, mapApi ? 'map XML relation' : 'Overpass relation');
    assert.equal(relation.holes.length, 1);
    assert.equal(relation.holes[0].length, 5);
    assert.equal(relation.heightM, 45);
    assert.equal(
      mesh.buildings.some((b) => b.osmId === 100),
      false,
    );
  }
});

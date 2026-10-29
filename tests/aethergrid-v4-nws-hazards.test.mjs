import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// Execute the production service, removing types only.
const source = await readFile(
  new URL('../apps/aethergrid-console/web/src/services/nws-hazards.ts', import.meta.url),
  'utf8',
);
const { loadNwsHazards } = await import(
  'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
);
const fetchedAt = '2026-10-01T12:00:00Z';
const effective = '2026-10-01T11:00:00Z';
const expires = '2026-10-01T15:00:00Z';
const ring = [
  [-74, 40],
  [-73, 40],
  [-73, 41],
  [-74, 40],
];

function alert(overrides = {}) {
  return {
    id: 'fixture-alert',
    event: 'Flood Warning',
    severity: 'Severe',
    effective,
    onset: '2026-10-01T10:00:00Z',
    expires,
    geometry: { type: 'Polygon', coordinates: [ring] },
    ...overrides,
  };
}

function fixture(t, alerts = [], receipt = { live: true }) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return new Response(
      JSON.stringify({
        receipt: { retrievedAt: fetchedAt, ...receipt },
        data: { alerts },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  });
  return requests;
}

test('NWS requests the active coordinate and forwards cancellation', async (t) => {
  const requests = fixture(t);
  const signal = new AbortController().signal;
  const result = await loadNwsHazards(40.7128, -74.006, signal);
  const url = new URL(requests[0].url, 'http://localhost');
  assert.equal(url.pathname, '/api/aethergrid/hazards/alerts');
  assert.equal(url.searchParams.get('lat'), '40.7128');
  assert.equal(url.searchParams.get('lon'), '-74.006');
  assert.equal(requests[0].options.signal, signal);
  assert.equal(requests[0].options.headers.accept, 'application/json');
  assert.deepEqual(result.coordinate, { latitude: 40.7128, longitude: -74.006 });
  assert.equal(result.fetchedAt, fetchedAt);
  assert.equal(result.attribution, 'US National Weather Service (api.weather.gov)');
});

test('NWS preserves receipt truth on both context and overlay', async (t) => {
  for (const receipt of [
    { live: true, stale: false, fallback: false },
    { live: true, stale: true, fallback: true },
    { live: false, stale: false, fallback: true },
  ]) {
    fixture(t, [], receipt);
    const result = await loadNwsHazards(40, -74);
    for (const target of [result, result.overlay]) {
      assert.equal(target.live, receipt.live);
      assert.equal(target.stale, receipt.stale);
      assert.equal(target.fallback, receipt.fallback);
    }
    t.mock.restoreAll();
  }
});

test('NWS emits exact source boundary segments and no affected-area fill', async (t) => {
  fixture(t, [alert()]);
  const { overlay } = await loadNwsHazards(40, -74);
  assert.equal(overlay.edges.length, 3);
  assert.deepEqual(overlay.areas, []);
  assert.deepEqual(
    overlay.edges.map((edge) => [
      [edge.from.longitude, edge.from.latitude],
      [edge.to.longitude, edge.to.latitude],
    ]),
    [
      [ring[0], ring[1]],
      [ring[1], ring[2]],
      [ring[2], ring[3]],
    ],
  );
  for (const edge of overlay.edges) {
    assert.equal(edge.properties.eventType, 'nws-alert-boundary');
    assert.equal(edge.properties.boundaryOnly, true);
    assert.equal(edge.intensity, 0.82);
    assert.equal(edge.validFrom, effective);
    assert.equal(edge.validTo, expires);
  }
});

test('NWS closes open rings and preserves multipolygon and hole identity', async (t) => {
  const open = ring.slice(0, 3);
  fixture(t, [
    alert({
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[open, open], [open]],
      },
    }),
  ]);
  const { overlay } = await loadNwsHazards(40, -74);
  assert.equal(overlay.edges.length, 9);
  assert.equal(new Set(overlay.edges.map((edge) => edge.id)).size, 9);
  assert.deepEqual(
    overlay.edges.map((edge) => [edge.properties.polygonIndex, edge.properties.ringIndex]),
    [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 1],
      [0, 1],
      [0, 1],
      [1, 0],
      [1, 0],
      [1, 0],
    ],
  );
  assert.deepEqual(overlay.areas, []);
});

test('NWS uses point-context markers and onset when geometry and effective are absent', async (t) => {
  fixture(t, [alert({ geometry: null, effective: null })]);
  const result = await loadNwsHazards(40, -74);
  assert.equal(result.alerts[0].geometryAvailable, false);
  assert.deepEqual(result.overlay.edges, []);
  const node = result.overlay.nodes[0];
  assert.equal(node.kind, 'event');
  assert.deepEqual(node.position, { latitude: 40, longitude: -74, heightMeters: 80 });
  assert.equal(node.properties.appliesAtQueryPoint, true);
  assert.equal(node.properties.geometryAvailable, false);
  assert.equal(node.validFrom, '2026-10-01T10:00:00Z');
  assert.equal(node.validTo, expires);
});

test('NWS bounds alert count, text, zones and total boundary segments', async (t) => {
  const coordinates = Array.from({ length: 2100 }, (_, i) => [-74 + i / 10000, 40]);
  fixture(
    t,
    Array.from({ length: 30 }, (_, i) =>
      alert({
        id: String(i),
        description: 'x'.repeat(1500),
        affectedZones: Array.from({ length: 70 }, () => 'zone'),
        geometry: { type: 'Polygon', coordinates: [coordinates] },
      }),
    ),
  );
  const result = await loadNwsHazards(40, -74);
  assert.equal(result.alerts.length, 24);
  assert.equal(result.overlay.nodes.length, 24);
  assert.equal(result.overlay.edges.length, 2000);
  assert.equal(result.alerts[0].description.length, 1200);
  assert.equal(result.alerts[0].affectedZones.length, 64);
});

test('NWS ignores invalid boundary coordinates and normalizes untrusted text', async (t) => {
  fixture(t, [
    alert({
      event: '  Flood\n Warning  ',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [181, 0],
            [0, 91],
            ['bad', 0],
          ],
        ],
      },
    }),
  ]);
  const result = await loadNwsHazards(40, -74);
  assert.equal(result.alerts[0].event, 'Flood Warning');
  assert.deepEqual(result.overlay.edges, []);
});

test('NWS reports HTTP and transport failures instead of successful empty data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(loadNwsHazards(40, -74), /HTTP 503/u);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('fixture transport failed');
  });
  await assert.rejects(loadNwsHazards(40, -74), /fixture transport failed/u);
});

test('NWS malformed JSON is empty and explicitly non-live fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{invalid'));
  const result = await loadNwsHazards(40, -74);
  assert.equal(result.live, false);
  assert.equal(result.fallback, true);
  assert.deepEqual(result.alerts, []);
  assert.deepEqual(result.overlay.nodes, []);
  assert.deepEqual(result.overlay.edges, []);
});

// Retain existing integration-wiring guards alongside the runtime assertions.
async function text(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8');
}

test('v4 NWS hazards render consistently in Cesium and native failover', async () => {
  const [cesium, nativeRenderer, palette] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/network-overlay-layer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/overlays/color-mapping.ts'),
  ]);

  for (const renderer of [cesium + palette, nativeRenderer]) {
    assert.match(renderer, /nws-alert/u);
    assert.match(renderer, /nws-alert-boundary/u);
    assert.match(renderer, /severity/u);
  }
  assert.match(cesium, /clampToGround/u);
  assert.match(nativeRenderer, /hazardHex/u);
});

test('v4 NWS hazard scene layer is live-only and excluded on fallback receipts', async () => {
  const [app, badges, cityTargets, presets] = await Promise.all([
    text('apps/aethergrid-console/web/src/app/App.tsx'),
    text('apps/aethergrid-console/web/src/components/LiveSceneBadges.tsx'),
    text('apps/aethergrid-console/web/src/app/city-targets.ts'),
    text('apps/aethergrid-console/web/src/app/use-case-presets.ts'),
  ]);

  assert.match(app, /loadNwsHazards/u);
  assert.match(app, /temporal\.mode !== 'live'/u);
  assert.match(app, /globalThis\.setInterval\(refresh, 60_000\)/u);
  assert.match(app, /!hazardContext\.fallback/u);
  assert.match(app, /<LiveSceneBadges/u);
  assert.match(badges, /NWS ACTIVE HAZARDS/u);
  assert.match(cityTargets, /\{ id: 'hazards', visible: true \}/u);
  assert.match(presets, /'hazards'/u);
});

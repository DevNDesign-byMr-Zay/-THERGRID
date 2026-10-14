import { expect, test, type Page } from '@playwright/test';

async function isolateGeometryContext(page: Page) {
  // Geometry contracts do not depend on changing live weather/cloud workloads.
  for (const url of ['**/api/aethergrid/weather/**', '**/api/aethergrid/city-live?**']) {
    await page.route(url, (route) => route.fulfill({ status: 503, json: { error: 'Live context unavailable in offline geometry contract fixture' } }));
  }
}

test('mapped building dossiers retain the provider and never label static massing live', async () => {
  const meshPath = '../src/services/city-power-overlay';
  const dossierPath = '../src/services/spatial-entity-dossier';
  const { cityMeshToSpatialBundle } = await import(meshPath);
  const { buildSpatialEntityDossier } = await import(dossierPath);
  const bundle = cityMeshToSpatialBundle({ city: { id: 'fixture', lat: 40, lon: -74 }, source: { provider: 'fixture-provider', live: true }, buildings: [{ id: 'mapped', heightM: 40, heightSource: 'height', footprint: [[0,0],[30,0],[30,30],[0,30]] }] });
  const area = bundle.semantics.find((snapshot: any) => snapshot.layerId === 'buildings').areas[0];
  expect(area.properties.sourceProvider).toBe('fixture-provider');
  const dossier = buildSpatialEntityDossier({ region: 'fixture', temporal: { mode: 'live', iso: '2026-10-11T12:00:00Z' }, visualMode: 'solid', useCase: null, selection: { id: area.id, kind: 'building', properties: { ...area.properties, live: true } }, measurement: null, observationA: null, observationB: null, cityIdentity: bundle.identity, atmosphere: null, liveContext: null });
  expect(dossier.entitySource.provider).toBe('fixture-provider');
  expect(dossier.entitySource.state).toBe('mapped');
  expect(dossier.contextSources[0].state).toBe('mapped');
});

test('Cesium roof instances use mapped color and share body source identity', async () => {
  const path = '../src/renderer/cesium/network-overlay-layer';
  const { NetworkOverlayLayer } = await import(path);
  const { PrimitiveCollection, DataSourceCollection } = await import('cesium');
  const primitives = new PrimitiveCollection();
  const dataSources = new DataSourceCollection();
  const layer = new NetworkOverlayLayer({ dataSources, scene: { primitives, requestRender() {} } } as any);
  await Promise.resolve();
  layer.apply({ id: 'fixture', layerId: 'buildings', eventTime: '2026-10-11T12:00:00Z', nodes: [], edges: [], areas: [{ id: 'roof', kind: 'building', positions: [[0,0],[.001,0],[.001,.001],[0,.001]].map(([longitude,latitude]) => ({ longitude, latitude })), properties: { heightM: 40, heightSource: 'height', roofShape: 'pyramidal', roofHeightM: 10, roofColor: '#955b41', buildingMaterial: 'concrete', sourceFeatureId: 'source-roof' } }] });
  const instances = primitives.get(0).geometryInstances;
  expect(instances).toHaveLength(5);
  expect([...instances[0].attributes.color.value]).toEqual([111, 120, 128, 255]);
  for (const roof of instances.slice(1)) {
    expect([...roof.attributes.color.value]).toEqual([149, 91, 65, 255]);
    expect(roof.id).toBe(instances[0].id);
    expect(roof.id.sourceFeatureId).toBe('source-roof');
  }
  layer.destroy();
  dataSources.destroy();
  primitives.destroy();
});

test('weather teardown respects Cesium cloud ownership and restores fog', async () => {
  const path = '../src/renderer/cesium/weather-atmosphere-layer';
  const { WeatherAtmosphereLayer } = await import(path);
  const { PrimitiveCollection } = await import('cesium');
  for (const destroyPrimitives of [true, false]) {
    const primitives = new PrimitiveCollection({ destroyPrimitives });
    const baseline = { enabled: false, density: .001, visualDensityScalar: .5, minimumBrightness: .2 };
    const fog = { ...baseline };
    const weather = new WeatherAtmosphereLayer({ scene: { primitives, fog, requestRender() {} } } as any);
    const clouds = primitives.get(0);
    fog.enabled = true;
    expect(() => weather.destroy()).not.toThrow();
    expect(clouds.isDestroyed()).toBe(true);
    expect(primitives.length).toBe(0);
    expect(fog).toEqual(baseline);
    expect(() => weather.destroy()).not.toThrow();
  }
});

test('geodetic teardown respects both Cesium primitive ownership policies', async () => {
  const path = '../src/renderer/cesium/geodetic-grid-layer';
  const { GeodeticGridLayer } = await import(path);
  const { PrimitiveCollection } = await import('cesium');
  // Material's browser-image type checks need constructors in this Node test.
  const globals = globalThis as any;
  const keys = ['HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'ImageBitmap', 'OffscreenCanvas'];
  const originals = keys.map((key) => globals[key]);
  keys.forEach((key) => { globals[key] = class {}; });
  try {
  for (const destroyPrimitives of [true, false]) {
    const primitives = new PrimitiveCollection({ destroyPrimitives });
    const grid = new GeodeticGridLayer({ primitives, requestRender() {} } as any);
    const collection = primitives.get(0);
    expect(() => grid.destroy()).not.toThrow();
    expect(collection.isDestroyed()).toBe(true);
    expect(primitives.length).toBe(0);
    expect(() => grid.destroy()).not.toThrow();
  }
  } finally {
    keys.forEach((key, index) => { if (originals[index] === undefined) delete globals[key]; else globals[key] = originals[index]; });
  }
});

test('compiled renderer switch activates the native wireframe fallback', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await isolateGeometryContext(page);
  await page.route('**/api/aethergrid/geospatial/city/**', (route) => route.fulfill({ json: {
    city: { id: 'new-york', lat: 40.7549, lon: -73.984 }, source: { provider: 'offline-geometry-contract', live: true, attribution: 'OFFLINE GEOMETRY FIXTURE — NOT CITY ACCURACY EVIDENCE' },
    buildings: [{ id: 'roof-fixture', heightM: 110, heightSource: 'height', roofShape: 'pyramidal', roofHeightM: 35, footprint: [[-60,-60],[60,-60],[60,60],[-60,60]] }], powerAssets: [], powerLines: [], roads: [], waterAreas: [], waterways: [], coastlines: [], greenAreas: []
  } }));
  await page.goto('/');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: /NEW YORK/ }).click();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count', '1');
  await page.getByText('Renderer tools', { exact: true }).click();
  await page.getByRole('group', { name: 'Spatial renderer' }).getByRole('button', { name: 'NATIVE', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'native-webgl', { timeout: 30_000 });
  await expect(page.locator('.viewport-warning')).toContainText('wireframe fallback');
  const warning = await page.locator('.viewport-warning').boundingBox();
  const viewport = page.viewportSize()!;
  expect(warning && warning.x <= viewport.width / 2 && warning.x + warning.width >= viewport.width / 2 && warning.y <= viewport.height / 2 && warning.y + warning.height >= viewport.height / 2, 'fallback notice must not cover scene center').toBe(false);
  const caption = await page.locator('.scene-caption').boundingBox();
  expect(warning && caption && warning.x < caption.x + caption.width && warning.x + warning.width > caption.x && warning.y < caption.y + caption.height && warning.y + warning.height > caption.y, 'fallback notice must not cover city identity').toBe(false);
  await expect(page.locator('.spatial-canvas canvas')).toBeVisible();
  const nativeWebgl = await page.locator('.native-spatial-canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl');
    return Boolean(gl && !gl.isContextLost());
  });
  expect(nativeWebgl, 'native acceptance requires WebGL, not the Canvas2D degradation path').toBe(true);
  await page.screenshot({ path: 'test-results/geometry-contract-native.png' });
});

test('building admission rejects self-touch and backtracking but permits forward collinear edges', async () => {
  const path = '../src/renderer/overlays/building-geometry';
  const { buildingGeometry } = await import(path);
  const area = (points: number[][]) => ({ id: 'ring', kind: 'building', properties: { heightM: 40 }, positions: points.map(([longitude, latitude]) => ({ longitude, latitude })) });
  expect(buildingGeometry(area([[0,0],[.002,0],[.002,.002],[.001,0],[0,.002]]))).toBeNull();
  expect(buildingGeometry(area([[0,0],[.003,0],[.002,0],[.002,.002],[0,.002]]))).toBeNull();
  expect(buildingGeometry(area([[0,0],[.001,0],[.002,0],[.002,.002],[0,.002]]))).not.toBeNull();
});

test('bounded dossier exports retain geometry provenance without exposing secrets', async () => {
  const path = '../src/services/spatial-entity-dossier';
  const { buildSpatialEntityDossier } = await import(path);
  const properties = { ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`extra${i}`, i])), heightCategory: 'explicit-tag', roofRefinement: 'source-tagged-pyramidal', geometryLimitation: null, roofColor: '#955b41', apiKey: 'private' };
  const dossier = buildSpatialEntityDossier({ region: 'new-york', temporal: { mode: 'live', iso: '2026-10-11T12:00:00Z' }, visualMode: 'solid', useCase: null, selection: { id: 'roof-fixture', kind: 'building', properties }, measurement: null, observationA: null, observationB: null, cityIdentity: null, atmosphere: null, liveContext: null });
  expect(dossier.entity.properties.heightCategory).toBe('explicit-tag');
  expect(dossier.entity.properties.roofRefinement).toBe('source-tagged-pyramidal');
  expect(dossier.entity.properties.roofColor).toBe('#955b41');
  expect(Object.keys(dossier.entity.properties)).toHaveLength(24);
  expect(dossier.entity.properties.apiKey).toBeUndefined();
});

test('source geometry validates massing and refines only explicit supported roofs', async () => {
  const path = '../src/renderer/overlays/building-geometry';
  const module = await import(path).catch(() => null);
  expect(module?.buildingGeometry).toBeInstanceOf(Function);
  const geometry = module!.buildingGeometry;
  const positions = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]].map(([longitude, latitude]) => ({ longitude, latitude }));
  const area = { id: 'source-1', kind: 'building', positions, properties: { heightM: 40, minHeightM: 5, heightSource: 'height', roofShape: 'pyramidal', roofHeightM: 6 } };
  const refined = geometry(area)!;
  expect(refined.wallTopM).toBe(34);
  expect(refined.topM).toBe(40);
  expect(refined.roofFaces).toHaveLength(4);
  expect(refined.heightCategory).toBe('explicit-tag');
  expect(geometry({ ...area, positions: [...positions, positions[0]] })!.roofFaces).toHaveLength(4);
  expect(geometry({ ...area, properties: { ...area.properties, heightM: Infinity } })).toBeNull();
  expect(geometry({ ...area, positions: [{ longitude: NaN, latitude: 0 }, ...positions] })).toBeNull();
  expect(geometry({ ...area, properties: { ...area.properties, roofHeightM: 80 } })!.roofFaces).toHaveLength(0);
  expect(geometry({ ...area, properties: { ...area.properties, roofShape: 'gabled' } })!.limitation).toContain('unsupported');
  expect(geometry({ ...area, properties: { heightM: 40, heightSource: 'building:levels' } })!.heightCategory).toBe('levels-derived');
  expect(geometry({ ...area, properties: { heightM: 40, heightSource: 'unknown-provider-field' } })!.heightCategory).toBe('modeled');
  expect(geometry({ ...area, properties: { heightSource: 'height' } })!.heightCategory).toBe('modeled');
  expect(geometry({ ...area, positions: [positions[0], positions[2], positions[1], positions[3]] })).toBeNull();
  expect(module!.buildingEdges(area)).toHaveLength(16);
  const concave = [positions[0], positions[1], { longitude: 0.0003, latitude: 0.0003 }, positions[2], positions[3]];
  expect(geometry({ ...area, positions: concave })!.roofFaces).toHaveLength(0);
});

for (const [id, name, lat, lon] of [
  ['new-york', 'NEW YORK', 40.7549, -73.984],
  ['london', 'LONDON', 51.5136, -0.0917],
  ['tokyo', 'TOKYO', 35.6896, 139.6917]
] as const) {
  test(`compiled Cesium admits mapped massing and explicit roof fixture in ${name}`, async ({ page }) => {
    // Includes two real GPU picks and dossier exports; fallback has its own test.
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await isolateGeometryContext(page);
    await page.route('**/api/aethergrid/geospatial/city/**', (route) => route.fulfill({ json: {
      city: { id, lat, lon },
      source: { provider: 'offline-geometry-contract', live: true, attribution: 'OFFLINE GEOMETRY FIXTURE — NOT CITY ACCURACY EVIDENCE', fetchedAt: '2026-10-11T12:00:00Z' },
      buildings: [
        { id: 'roof-fixture', heightM: 110, heightSource: 'height', roofShape: 'pyramidal', roofHeightM: 35, roofColor: '#955b41', buildingMaterial: 'concrete', footprint: [[-60,-60],[60,-60],[60,60],[-60,60]] },
        { id: 'levels-fixture', heightM: 65, heightSource: 'building:levels', footprint: [[130,-60],[230,-60],[230,60],[130,60]] },
        { id: 'modeled-fixture', heightM: 25, heightSource: 'inferred', footprint: [[-230,-60],[-130,-60],[-130,60],[-230,60]] },
        { id: 'rejected-fixture', heightM: -12, heightSource: 'height', footprint: [[300,-60],[350,-60],[350,60],[300,60]] }
      ], powerAssets: [], powerLines: [], roads: [], waterAreas: [], waterways: [], coastlines: [], greenAreas: []
    } }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Close navigation drawer' }).click();
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 30_000 });
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
    await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count', '3');
    await expect(page.locator('.cesium-widget-errorPanel')).not.toBeVisible();
    await page.getByRole('button', { name: 'INTEL', exact: true }).click();
    await expect(page.getByLabel('Building geometry coverage')).toContainText('1 supported mapped roofs');
    await expect(page.getByLabel('Building geometry coverage')).toContainText('1 invalid buildings withheld');
    await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
    await expect(page.locator('.journey-status')).not.toBeVisible();
    await page.screenshot({ path: `test-results/geometry-contract-${id}.png` });
    console.info(`${id}: geometry coverage admitted; checking rendered selection`);
    // The central fixture's roof and facade are actual rendered geometry.
    for (const y of [395, 430]) {
      await page.mouse.click(680, y);
      console.info(`${id}: clicked geometry at ${y}`);
      await page.getByRole('button', { name: 'INTEL', exact: true }).click();
      await page.getByLabel('Inspector view').selectOption('entity');
      await expect(page.locator('.entity-dossier')).toContainText('roof-fixture');
      const downloadPromise = page.waitForEvent('download');
      const exportButton = page.getByRole('button', { name: 'EXPORT DOSSIER JSON' });
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
      await exportButton.focus();
      await expect(exportButton).toBeFocused();
      await exportButton.press('Enter');
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream!) chunks.push(chunk);
      const dossier = JSON.parse(Buffer.concat(chunks).toString());
      console.info(`${id}: exported ${dossier.entity.sourceFeatureId}`);
      expect(dossier.entity.sourceFeatureId).toBe('roof-fixture');
      expect(dossier.entity.properties.heightCategory).toBe('explicit-tag');
      expect(dossier.entity.properties.roofRefinement).toBe('source-tagged-pyramidal');
      expect(dossier.entity.properties.roofColor).toBe('#955b41');
      expect(dossier.entitySource.attribution).toContain('OFFLINE GEOMETRY FIXTURE');
      expect(dossier.entitySource.provider).toBe('offline-geometry-contract');
      expect(dossier.entitySource.state).toBe('mapped');
      await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
    }
  });
}

test('native massing projects height and preserves ground measurement inversion', async () => {
  const path = '../src/renderer/native/local-projection';
  const module = await import(path).catch(() => null);
  expect(module?.projectLocal).toBeInstanceOf(Function);
  for (const heading of [0, 67, 180]) {
    for (const pitch of [-25, -55, -90]) {
      const ground = module!.projectLocal(120, -300, 0, heading, pitch);
      const recovered = module!.unprojectGround(ground[0], ground[1], heading, pitch);
      expect(recovered[0]).toBeCloseTo(120);
      expect(recovered[1]).toBeCloseTo(-300);
      if (pitch !== -90) expect(module!.projectLocal(120, -300, 200, heading, pitch)[1]).toBeGreaterThan(ground[1]);
    }
  }
});

test('an obsolete camera journey never cancels the newer city arrival', async () => {
  const path = '../src/renderer/cesium/camera-journey-controller';
  const { CameraJourneyController } = await import(path);
  const flights: { complete(): void }[] = [];
  let cancellations = 0;
  const camera = {
    flyToBoundingSphere: (_sphere: unknown, options: { complete(): void }) => flights.push(options),
    cancelFlight: () => { cancellations += 1; flights.at(-1)?.complete(); }
  };
  const controller = new CameraJourneyController(camera as any);
  const old = controller.flyTo({ latitude: 40, longitude: -74, journey: 'direct' });
  const current = controller.flyTo({ latitude: 51, longitude: 0, journey: 'direct' });
  flights[0].complete();
  await old;
  expect(cancellations, 'old completion must not cancel the active flight').toBe(0);
  flights[1].complete();
  await current;
});

test('native arrivals cancel obsolete frames and settle both callers', async () => {
  const path = '../src/renderer/native/native-webgl-renderer';
  const { NativeWebglSpatialRenderer } = await import(path);
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  globalThis.requestAnimationFrame = (callback) => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = (id) => { frames.delete(id); };
  const renderer = new NativeWebglSpatialRenderer();
  try {
    const old = renderer.flyTo({ latitude: 40, longitude: -74, journey: 'direct' });
    const current = renderer.flyTo({ latitude: 51, longitude: 0, journey: 'direct' });
    expect(frames.size).toBe(1);
    [...frames.values()][0](performance.now() + 1_000);
    await Promise.all([old, current]);
    expect(renderer.status().busy).toBe(false);
  } finally {
    renderer.destroy();
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});

test('city coverage excludes invalid massing and distinguishes tagged estimates from modeled heights', async () => {
  const path = '../src/services/city-power-overlay';
  const { cityMeshToSpatialBundle } = await import(path);
  const footprint = [[-25, -25], [25, -25], [25, 25], [-25, 25]];
  const buildings = ['height', 'est_height', 'building:levels', 'inferred'].map((heightSource, index) => ({ id: `fixture-${index}`, heightM: 40, heightSource, footprint }));
  buildings.push({ id: 'invalid-height', heightM: -30, heightSource: 'height', footprint });
  const bundle = cityMeshToSpatialBundle({ city: { id: 'fixture', lat: 40, lon: -74 }, buildings });
  expect(bundle.identity.buildingCount).toBe(4);
  expect(bundle.identity.rejectedBuildingCount).toBe(1);
  expect(bundle.identity.explicitHeightCoveragePercent).toBe(25);
  expect(bundle.identity.estimatedHeightCoveragePercent).toBe(25);
  expect(bundle.identity.levelsDerivedHeightCoveragePercent).toBe(25);
  expect(bundle.identity.modeledHeightCoveragePercent).toBe(25);
  expect(bundle.illumination.nodes.map((node: any) => node.properties.sourceBuildingId)).not.toContain('invalid-height');
});

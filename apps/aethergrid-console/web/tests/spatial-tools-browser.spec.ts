import { expect, test, type Page } from '@playwright/test';

async function mappedCity(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', (route) => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort('internetdisconnected'));
  await page.route('**/api/aethergrid/**', (route) => ['/api/aethergrid/config/public','/api/aethergrid/profile'].includes(new URL(route.request().url()).pathname) ? route.continue() : route.fulfill({ status: 503, json: { error: 'Unrelated provider unavailable in offline spatial contract' } }));
  await page.route('**/api/aethergrid/geospatial/city/**', (route) => route.fulfill({ json: {
    city: route.request().url().includes('/london') ? { id: 'london', lat: 51.5136, lon: -.0917 } : { id: 'new-york', lat: 40.7549, lon: -73.984 }, source: { provider: 'offline-spatial-contract', live: true, attribution: 'OFFLINE SPATIAL CONTRACT — NOT CITY ACCURACY EVIDENCE' },
    buildings: [{ id: 'roof-fixture', heightM: 110, heightSource: 'height', roofShape: 'pyramidal', roofHeightM: 35, roofColor: '#955b41', footprint: [[-60,-60],[60,-60],[60,60],[-60,60]] }], powerAssets: [], powerLines: [], roads: [], waterAreas: [], waterways: [], coastlines: [], greenAreas: []
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: /NEW YORK/ }).click();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count', '1');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true');
}

test('captured backend scenario restores its own effects after another scenario is active', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('aethergrid.operator.spatial-bookmarks.v4', JSON.stringify([1.1,1.8].map((stressFactor,index) => ({
    id: `backend-${index}`, name: `Backend frame ${index}`, createdAt: '2026-10-12T12:00:00Z', scope: 'city',
    target: { id: 'new-york', name: 'NEW YORK', latitude: 40.7549, longitude: -73.984, rangeMeters: 2800 },
    visualMode: 'solid', temporalMode: 'scenario', cursorIso: '2026-10-12T12:00:00Z', scenarioId: `backend-${index}`,
    scenarioVisual: { stressFactor, renewableBias: 0, weatherRisk: 0, storageStress: 0 }, useCase: null, layers: []
  })))));
  await mappedCity(page);
  async function restore(index: number) {
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'SAVED', exact: true }).click();
    await page.locator('.bookmark-restore').filter({ hasText: `Backend frame ${index}` }).click();
    if (await page.getByRole('button', { name: 'Close navigation drawer' }).isVisible()) await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  }
  await restore(0);
  await expect(page.locator('.scenario-scene-badge')).toContainText('1.10×');
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  await page.getByRole('navigation', { name: 'Intelligence workspace' }).getByRole('button', { name: 'ANALYSIS', exact: true }).click();
  await page.locator('.comparison-frames > div').nth(0).getByRole('button', { name: 'CAPTURE', exact: true }).click();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  await restore(1);
  await expect(page.locator('.scenario-scene-badge')).toContainText('1.80×');
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  await page.getByRole('button', { name: 'SHOW FRAME A', exact: true }).click();
  await expect(page.locator('.scenario-scene-badge')).toContainText('1.10×');
});

test('compiled source wireframe and grid controls preserve real Cesium rendering', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await mappedCity(page);
  expect(await page.getByRole('button', { name: 'WIREFRAME', exact: true }).count()).toBe(1);
  await page.getByRole('button', { name: 'WIREFRAME', exact: true }).click();
  await expect(page.getByRole('button', { name: 'WIREFRAME', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
  await expect(page.locator('.cesium-widget-errorPanel')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/spatial-wireframe-cesium.png' });
  await page.getByRole('group', { name: 'Visual mode' }).getByRole('button', { name: 'GRID', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Visual mode' }).getByRole('button', { name: 'GRID', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cesium-widget-errorPanel')).not.toBeVisible();
});

test('mobile native disclosure clears expanded forecast transport', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await mappedCity(page);
  await page.getByText('Renderer tools', { exact: true }).click();
  await page.getByRole('group', { name: 'Spatial renderer' }).getByRole('button', { name: 'NATIVE', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'native-webgl');
  await page.getByText('Renderer tools', { exact: true }).click();
  await page.route('**/api/aethergrid/weather/forecast?**', route => route.fulfill({ json: { data: { timesteps: ['12:00','13:00'].map(time => ({ time: `2026-10-12T${time}:00Z`, temperatureCelsius: 12 })) }, receipt: { live: true, fallback: false } } }));
  const rail = page.getByRole('region', { name: '4D time controls' });
  await rail.getByRole('button', { name: 'FORECAST', exact: true }).click();
  await expect(rail.getByRole('combobox', { name: 'Forecast valid time' })).toBeEnabled();
  await rail.getByText('Forecast replay range', { exact: true }).click();
  await expect(page.locator('.native-fidelity')).toContainText('wireframe fallback');
  await expect.poll(async () => {
    const warning = (await page.locator('.native-fidelity').boundingBox())!, timeline = (await rail.boundingBox())!;
    return warning.y + warning.height <= timeline.y;
  }).toBe(true);
  await page.mouse.move(200, 760);
  await page.mouse.wheel(0, 500);
  await expect.poll(async () => {
    const status = (await rail.locator('.temporal-data-status').boundingBox())!, timeline = (await rail.boundingBox())!;
    return status.y >= timeline.y && status.y + status.height <= timeline.y + timeline.height;
  }).toBe(true);
  await page.screenshot({ path: 'test-results/spatial-mobile-native-forecast.png' });
});

test('forecast comparison retains A/B receipts and revalidates frame switching without clamping', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await mappedCity(page);
  let loseEndpoint = false;
  await page.route('**/api/aethergrid/weather/forecast?**', route => route.fulfill({ json: {
    data: { timesteps: (loseEndpoint ? ['12:00','15:00'] : ['12:00','13:00']).map((time,index) => ({ time: `2026-10-12T${time}:00Z`, temperatureCelsius: 12+index*3, windSpeed: 5 })) },
    receipt: { live: true, fallback: false, stale: false, provider: 'offline-comparison-contract', attribution: 'OFFLINE COMPARISON CONTRACT' }
  } }));
  const rail = page.getByRole('region', { name: '4D time controls' });
  await rail.getByRole('button', { name: 'FORECAST', exact: true }).click();
  const validTime = rail.getByRole('combobox', { name: 'Forecast valid time' });
  await expect(validTime).toBeEnabled();
  await validTime.selectOption('2026-10-12T12:00:00.000Z');
  async function openComparison() {
    await page.getByRole('button', { name: 'INTEL', exact: true }).click();
    await page.getByRole('navigation', { name: 'Intelligence workspace' }).getByRole('button', { name: 'ANALYSIS', exact: true }).click();
  }
  await openComparison();
  await page.locator('.comparison-frames > div').nth(0).getByRole('button', { name: 'CAPTURE', exact: true }).click();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  await validTime.selectOption('2026-10-12T13:00:00.000Z');
  await openComparison();
  await page.locator('.comparison-frames > div').nth(1).getByRole('button', { name: 'CAPTURE', exact: true }).click();
  await expect(page.locator('.comparison-deltas')).toContainText('12.00 °C → 15.00 °C');
  await expect(page.locator('.comparison-deltas')).toContainText('FORECAST');
  await page.getByRole('button', { name: 'SHOW FRAME A', exact: true }).click();
  await expect(rail.locator('output')).toHaveAttribute('data-cursor','2026-10-12T12:00:00.000Z');
  loseEndpoint = true;
  await page.getByRole('button', { name: 'SHOW FRAME B', exact: true }).click();
  await expect(rail.locator('output')).toHaveAttribute('data-cursor','2026-10-12T13:00:00.000Z');
  await expect(rail).toContainText('Saved replay window unavailable in current source coverage');
  await expect(page.locator('.comparison-deltas')).toContainText('12.00 °C → 15.00 °C');
  await page.screenshot({ path: 'test-results/spatial-forecast-comparison.png' });
});

test('compiled scene export records the active Cesium and native camera without runtime configuration', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await mappedCity(page);
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  await page.getByRole('navigation', { name: 'Intelligence workspace' }).getByRole('button', { name: 'ANALYSIS', exact: true }).click();
  const exportButton = page.getByRole('button', { name: 'EXPORT SCENE JSON', exact: true });
  expect(await exportButton.count()).toBe(1);
  async function downloadScene() {
    const pending = page.waitForEvent('download'); await exportButton.focus(); await exportButton.press('Enter');
    const stream = await (await pending).createReadStream(), chunks = [];
    for await (const chunk of stream!) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString());
  }
  const cesium = await downloadScene();
  expect(cesium.camera.projection).toBe('geocentric');
  expect(cesium.camera.heightMeters).toBeGreaterThan(100);
  expect(cesium.target.latitude).toBe(40.7549);
  expect(cesium.schemaVersion).toBe('aethergrid.spatial-scene.v1');
  expect(JSON.stringify(cesium)).not.toMatch(/cesiumIonToken|apiKey|accessToken|profile/);
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  await page.getByText('Renderer tools', { exact: true }).click();
  await page.getByRole('group', { name: 'Spatial renderer' }).getByRole('button', { name: 'NATIVE', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'native-webgl');
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  const native = await downloadScene();
  expect(native.camera.projection).toBe('local-projected');
  expect(native.camera.target.rangeMeters).toBeGreaterThan(0);
  expect(native.limitations.join(' ')).toContain('projected');
});

for (const width of [1366, 390]) test(`picked area measurement finishes and clears at ${width}px`, async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
  await mappedCity(page);
  if (width === 390) {
    await page.getByText('Renderer tools', { exact: true }).click();
    await page.getByRole('group', { name: 'Spatial renderer' }).getByRole('button', { name: 'NATIVE', exact: true }).click();
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'native-webgl');
    await page.getByText('Renderer tools', { exact: true }).click();
  }
  const area = page.getByRole('group', { name: 'Spatial interaction' }).getByRole('button', { name: 'AREA', exact: true });
  expect(await area.count()).toBe(1);
  await area.click();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  const host = page.getByLabel('ÆTHERGRID 4D spatial viewport');
  const box = (await host.boundingBox())!;
  for (const [x,y] of [[.42,.42],[.58,.42],[.58,.56],[.42,.56]]) await host.click({ position: { x: box.width*x, y: box.height*y } });
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  await page.getByRole('button', { name: 'Finish area', exact: true }).click();
  if (width === 1366) {
    await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'SESSION', exact: true }).click();
    await page.getByRole('textbox', { name: 'Operator session name' }).fill('Area geometry receipt');
    await page.getByRole('button', { name: 'SAVE SESSION', exact: true }).click();
    const heights = await page.evaluate(() => JSON.parse(localStorage.getItem('aethergrid.operator.workspace-sessions.v4')!)[0].workspace.measurementPoints.map((point: any) => point.heightMeters));
    console.info('Picked area surface heights (m):', JSON.stringify(heights));
    await page.getByRole('button', { name: 'Close navigation drawer' }).click();
    await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  }
  await expect(page.locator('.analysis-results')).toContainText('m²');
  await expect(page.locator('.analysis-boundary').filter({ hasText: 'LOCAL TANGENT' })).toContainText('not terrain surface area');
  await page.screenshot({ path: `test-results/spatial-area-${width}.png` });
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  // Cesium entity geometry resolves asynchronously after React's result panel.
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `test-results/spatial-area-scene-${width}.png` });
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  if (width === 1366) {
    await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'WORLD', exact: true }).click();
    await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: /LONDON/ }).click();
    await page.getByRole('button', { name: 'Close navigation drawer' }).click();
    await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  } else await page.getByRole('button', { name: 'CLEAR MEASUREMENT', exact: true }).click();
  await expect(page.locator('.analysis-results')).not.toBeVisible();
});

test('compiled layer opacity is independent and persists into the native fallback', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await mappedCity(page);
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'LAYERS', exact: true }).click();
  const opacity = page.getByRole('slider', { name: 'buildings opacity', exact: true });
  expect(await opacity.count()).toBe(1);
  await opacity.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight');
  await expect(opacity).toHaveValue('0.25');
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await page.screenshot({ path: 'test-results/spatial-opacity-cesium.png' });
  await page.getByText('Renderer tools', { exact: true }).click();
  await page.getByRole('group', { name: 'Spatial renderer' }).getByRole('button', { name: 'NATIVE', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'native-webgl');
  const activeWebgl = await page.locator('.native-spatial-canvas').evaluate((canvas) => Boolean((canvas as HTMLCanvasElement).getContext('webgl')));
  expect(activeWebgl).toBe(true);
  await page.screenshot({ path: 'test-results/spatial-opacity-native.png' });
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await expect(page.getByRole('slider', { name: 'buildings opacity', exact: true })).toHaveValue('0.25');
});

test('operator scenario transport uses its declared modeled interval', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => { if (localStorage.getItem('aethergrid.operator.workspace-sessions.v4')) return; localStorage.setItem('aethergrid.operator.scenarios.v4', JSON.stringify([{
    schemaVersion: 'aethergrid.operator-scenario.v1', kind: 'operator-scenario', authoritative: false, modeled: true,
    id: 'offline-modeled-replay', version: 1, parentScenarioId: null, name: 'Offline modeled replay', description: 'OFFLINE OPERATOR CONTRACT',
    status: 'draft', template: 'custom', parameters: { loadMultiplierPercent: 110, renewableAvailabilityPercent: 100, storageReservePercent: 18, weatherRiskPercent: 20 },
    startIso: '2026-10-12T12:00:00.000Z', endIso: '2026-10-12T13:00:00.000Z', createdAt: '2026-10-12T11:00:00Z', updatedAt: '2026-10-12T11:00:00Z',
    assumptions: [], references: { canonicalEntityIds: [], incidentIds: [], observationIds: [], regions: ['new-york'] },
    baseline: { capturedAt: '2026-10-12T11:00:00Z', temporal: { iso: '2026-10-12T12:00:00Z', mode: 'live', liveReferenceIso: '2026-10-12T12:00:00Z' },
      region: 'new-york', positionedEntityCount: 0, analyticalEdgeCount: 0, totalTreeDistanceMeters: 0, maximumPairDistanceMeters: 0 }
  }])); });
  await mappedCity(page);
  await page.getByRole('button', { name: 'SCENARIOS', exact: true }).click();
  await page.getByRole('button', { name: 'ACTIVATE MODEL', exact: true }).click();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  const rail = page.getByRole('region', { name: '4D time controls' });
  expect(await rail.getByRole('button', { name: 'Play modeled scenario', exact: true }).count()).toBe(1);
  await expect(rail).toContainText('MODELED REPLAY');
  await rail.getByRole('combobox', { name: 'Replay speed' }).selectOption('86400');
  await rail.getByRole('button', { name: 'Play modeled scenario' }).click();
  await expect(rail.locator('output')).toHaveAttribute('data-cursor', '2026-10-12T13:00:00.000Z');
  await expect(rail.getByRole('button', { name: 'Play modeled scenario' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/spatial-modeled-replay.png' });
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'SESSION', exact: true }).click();
  await page.getByRole('textbox', { name: 'Operator session name' }).fill('Embedded model');
  await page.getByRole('button', { name: 'SAVE SESSION', exact: true }).click();
  await page.evaluate(() => localStorage.removeItem('aethergrid.operator.scenarios.v4'));
  // Restore a session containing its own model, independent of the scenario collection.
  await mappedCity(page);
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'SESSION', exact: true }).click();
  await page.locator('.operator-session-list article').filter({ hasText: 'Embedded model' }).getByRole('button', { name: 'RESTORE', exact: true }).click();
  await page.getByRole('button', { name: 'Close intelligence drawer' }).click();
  await expect(rail).toContainText('MODELED REPLAY');
  await rail.getByRole('button', { name: 'Scenario start', exact: true }).click();
  await expect(rail.getByRole('button', { name: 'Play modeled scenario' })).toBeEnabled();
});

test('saved forecast windows stay unavailable when returned coverage loses an endpoint', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => localStorage.setItem('aethergrid.operator.spatial-bookmarks.v4', JSON.stringify([{
    id: 'old-window', name: 'Expired window', createdAt: '2026-10-12T11:00:00Z', scope: 'city',
    target: { id: 'new-york', name: 'NEW YORK', latitude: 40.7549, longitude: -73.984, rangeMeters: 2800 },
    visualMode: 'solid', temporalMode: 'forecast', cursorIso: '2026-10-12T12:00:00.000Z', scenarioId: null, useCase: null,
    playbackRange: { start: '2026-10-12T12:00:00.000Z', end: '2026-10-12T13:00:00.000Z' }, layers: []
  }])));
  await mappedCity(page);
  await page.route('**/api/aethergrid/weather/forecast?**', (route) => route.fulfill({ json: {
    data: { timesteps: ['12:00','15:00'].map((time) => ({ time: `2026-10-12T${time}:00Z`, temperatureCelsius: 12 })) },
    receipt: { provider: 'offline-window-contract', live: true, fallback: false, stale: false, attribution: 'OFFLINE SOURCE WINDOW CONTRACT' }
  } }));
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'Navigation workspace' }).getByRole('button', { name: 'SAVED', exact: true }).click();
  await page.getByRole('button', { name: /^Expired window/ }).click();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  const rail = page.getByRole('region', { name: '4D time controls' });
  await expect(rail.getByRole('combobox', { name: 'Forecast valid time' })).toBeEnabled();
  expect(await rail.getByText('Saved replay window unavailable in current source coverage', { exact: true }).count()).toBe(1);
  await expect(rail.getByRole('button', { name: 'Play source samples' })).toBeDisabled();
  await rail.getByText('Forecast replay range', { exact: true }).click();
  await rail.getByRole('button', { name: 'Use full source range' }).click();
  await expect(rail.getByRole('button', { name: 'Play source samples' })).toBeEnabled();
});

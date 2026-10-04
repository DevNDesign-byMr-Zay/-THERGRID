import { expect, test } from '@playwright/test';

test('credentialed Cesium globe and city descent', async ({ page }, testInfo) => {
  test.skip(process.env.AETHERGRID_TEST_REQUIRE_CESIUM !== '1');
  test.setTimeout(90_000);
  const failures: { host: string; path: string; error: string | null }[] = [];
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    failures.push({ host: url.hostname, path: url.pathname, error: request.failure()?.errorText ?? null });
  });
  const network: { host: string; path: string; status: number; type: string | undefined }[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    network.push({ host: url.hostname, path: url.pathname, status: response.status(), type: response.headers()['content-type'] });
  });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'GLOBAL', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 45_000 });
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
  await page.waitForTimeout(12_000);
  await page.screenshot({ path: 'test-results/cesium-global-1536x1024.png' });
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'GRID', exact: true }).click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true');
  await page.waitForTimeout(12_000);
  await page.screenshot({ path: 'test-results/cesium-city-1536x1024.png' });
  await testInfo.attach('cesium-source-network', { body: Buffer.from(JSON.stringify({ network, failures }, null, 2)), contentType: 'application/json' });
  const resources = network.filter((item) => item.status === 200 && /(^|\.)cesium\.com$/.test(item.host));
  expect(resources.some((item) => /\.terrain$/.test(item.path) || item.type?.includes('quantized-mesh')), 'successful terrain tile').toBeTruthy();
  expect(resources.some((item) => /image\/(jpeg|png|webp)/.test(item.type ?? '')), 'successful imagery tile').toBeTruthy();
  expect(resources.some((item) => /\.(b3dm|glb)$/.test(item.path)), 'successful city building tile').toBeTruthy();
  await expect(page.locator('.cesium-widget-errorPanel')).not.toBeVisible();
});

test('Cesium static assets keep their package-relative URLs', async ({ request }) => {
  const terrain = await request.get('/cesium/Assets/approximateTerrainHeights.json');
  expect(terrain.headers()['content-type']).toContain('application/json');
  const json = await terrain.json();
  expect(Object.keys(json).length).toBeGreaterThan(0);
  const texture = await request.get('/cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg');
  expect(texture.headers()['content-type']).toContain('image/jpeg');
  const worker = await request.get('/cesium/Workers/createBoxGeometry.js');
  expect(worker.headers()['content-type']).toMatch(/javascript/);
});

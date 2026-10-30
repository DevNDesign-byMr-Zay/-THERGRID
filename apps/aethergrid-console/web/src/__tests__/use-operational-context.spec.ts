import { expect, test } from '@playwright/test';

test('operational sources expose failures, clear non-live data and stop polling after mode change', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('aethergrid.operator.operational-source-bindings.v1', JSON.stringify([
    { scopeId: 'coord:40.75000:-73.98000', gaugeId: 'BATN6', energyRegion: 'NYIS', updatedAt: null },
  ])));
  let requests = 0;
  await page.route('**/api/**', async route => { requests++; await route.fulfill({ status: 503, body: 'provider unavailable' }); });
  await page.goto('/tests/hook-harness.html?hook=operational');
  await expect(page.getByText('Operational ready')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).hook.hydrologyError)).toBeTruthy();
  await expect.poll(() => page.evaluate(() => (window as any).hook.hazardError)).toBeTruthy();
  await expect.poll(() => page.evaluate(() => (window as any).hook.transitError)).toBeTruthy();
  await expect.poll(() => requests).toBe(3);
  await page.clock.runFor(60_000);
  await expect.poll(() => requests).toBe(7);
  await page.evaluate(() => (window as any).update({ mode: 'historical' }));
  await expect.poll(() => page.evaluate(() => [
    (window as any).hook.hazardContext, (window as any).hook.hazardError,
    (window as any).hook.transitContext, (window as any).hook.transitError,
    (window as any).hook.hydrologyContext, (window as any).hook.hydrologyError,
  ])).toEqual([null, null, null, null, null, null]);
  expect(await page.evaluate(() => (window as any).requests.every((request: any) => request.signal.aborted))).toBe(true);
  await page.clock.runFor(120_000);
  expect(requests).toBe(7);
  await page.evaluate(() => (window as any).unmount());
});

test('hydrology binding changes cancel the previous gauge and follow only the current coordinate scope', async ({ page }) => {
  const gauges: string[] = [];
  await page.route('**/api/**', route => {
    const gauge = new URL(route.request().url()).searchParams.get('gaugeId');
    if (gauge) gauges.push(gauge);
    return route.fulfill({ status: 503, body: 'provider unavailable' });
  });
  await page.goto('/tests/hook-harness.html?hook=operational');
  await expect(page.getByText('Operational ready')).toBeVisible();
  await page.evaluate(() => (window as any).saveBinding('coord:40.75000:-73.98000', { gaugeId: 'BATN6' }));
  await expect.poll(() => gauges).toEqual(['BATN6']);
  await page.evaluate(() => (window as any).saveBinding('coord:40.75000:-73.98000', { gaugeId: 'OTHER' }));
  await expect.poll(() => gauges).toEqual(['BATN6', 'OTHER']);
  expect(await page.evaluate(() => (window as any).requests.find((request: any) => request.url.includes('gaugeId=BATN6')).signal.aborted)).toBe(true);
  await page.evaluate(() => (window as any).update({ city: { id: 'london', latitude: 51.5, longitude: -0.12 } }));
  await expect.poll(() => page.evaluate(() => (window as any).hook.operationalBindings.gaugeId)).toBe(null);
  expect(await page.evaluate(() => (window as any).requests.find((request: any) => request.url.includes('gaugeId=OTHER')).signal.aborted)).toBe(true);
  await page.evaluate(() => (window as any).unmount());
  expect(await page.evaluate(() => (window as any).listenerCount('aethergrid:operational-source-bindings-changed'))).toBe(0);
});

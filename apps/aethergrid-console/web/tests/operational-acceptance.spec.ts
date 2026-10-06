import { expect, test } from '@playwright/test';

test('verified New York bindings display NOAA, EIA and ferry receipts', async ({ page }, testInfo) => {
  test.skip(process.env.AETHERGRID_TEST_REQUIRE_OPERATIONAL !== '1');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Intelligence workspace' }).getByRole('button', { name: 'OPS', exact: true }).click();
  await page.getByRole('textbox', { name: 'NOAA NWPS GAUGE ID' }).fill('BATN6');
  await page.getByRole('textbox', { name: 'EIA REGION CODE' }).fill('NYIS');
  const gaugeResponse = page.waitForResponse((r) => r.url().includes('/hydrology/gauges?gaugeId=BATN6'));
  const energyResponse = page.waitForResponse((r) => r.url().includes('/energy/context?region=NYIS'));
  await page.getByRole('button', { name: 'APPLY BINDINGS' }).click();
  const receipts = [];
  for (const pending of [gaugeResponse, energyResponse]) {
    const response = await pending;
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.receipt.live).toBe(true);
    expect(payload.receipt.fallback).toBe(false);
    receipts.push(payload.receipt);
  }
  const gauge = page.locator('.provider-card').filter({ hasText: 'HYDROLOGY' });
  await expect(gauge).toHaveAttribute('data-provider-state', 'live');
  await expect(gauge).toContainText('BATN6');
  await expect(gauge).not.toContainText('-999');
  await expect(page.locator('.eia-fuel-mix')).toBeVisible({ timeout: 30_000 });
  const transit = await page.request.get('/api/aethergrid/transit/realtime?cityId=new-york');
  const payload = await transit.json();
  expect(payload.receipt.live).toBe(true);
  expect(payload.receipt.fallback).not.toBe(true);
  expect(payload.receipt.stale).not.toBe(true);
  const realtimeRecords =
    (Array.isArray(payload.data.vehicles) ? payload.data.vehicles.length : 0) +
    (Array.isArray(payload.data.tripUpdates) ? payload.data.tripUpdates.length : 0) +
    (Array.isArray(payload.data.alerts) ? payload.data.alerts.length : 0);
  expect(realtimeRecords).toBeGreaterThan(0);
  receipts.push(payload.receipt);
  await testInfo.attach('operational-source-receipts', { body: Buffer.from(JSON.stringify(receipts, null, 2)), contentType: 'application/json' });
  await page.screenshot({ path: 'test-results/operational-new-york-1536x1024.png' });
});

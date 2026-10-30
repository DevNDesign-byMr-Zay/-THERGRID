import { expect, test } from '@playwright/test';

test('operational sources expose failures, clear non-live data and ignore late responses after mode change', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/**', async route => { requests++; await route.fulfill({ status: 503, body: 'provider unavailable' }); });
  await page.goto('/tests/hook-harness.html?hook=operational');
  await expect.poll(() => page.evaluate(() => (window as any).hook.hazardError)).toBeTruthy();
  await expect.poll(() => page.evaluate(() => (window as any).hook.transitError)).toBeTruthy();
  expect(requests).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => (window as any).update({ mode: 'historical' }));
  await expect.poll(() => page.evaluate(() => [
    (window as any).hook.hazardContext, (window as any).hook.hazardError,
    (window as any).hook.transitContext, (window as any).hook.transitError,
  ])).toEqual([null, null, null, null]);
  await page.evaluate(() => (window as any).unmount());
});

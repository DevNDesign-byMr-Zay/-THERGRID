import { expect, test } from '@playwright/test';

test('Connection Center preserves unknown provider states and marks failed refresh stale', async ({ page }) => {
  let fail = false;
  await page.route('**/api/aethergrid/runtime', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/aethergrid/runtime/providers', (route) => route.fulfill(fail
    ? { status: 503, json: { error: 'provider unavailable' } }
    : { json: { weather: { provider: 'fixture-weather', status: 'ready' }, energy: { provider: 'fixture-energy', status: 'new-state' } } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await page.getByRole('button', { name: 'DEVELOPER / DIAGNOSTICS', exact: true }).click();
  const center = page.locator('.provider-connection-center:visible');
  await expect(center.locator('[data-provider-capability="weather"]')).toContainText('NOT LIVE VERIFIED');
  await expect(center.locator('[data-provider-capability="energy"]')).toContainText('UNKNOWN');
  await expect(center).toContainText('REGISTRY CHECKED');
  fail = true;
  await center.getByRole('button', { name: 'Refresh provider connections' }).click();
  await expect(center.getByRole('alert')).toBeVisible();
  await expect(center).toHaveAttribute('data-registry-state', 'stale');
});

test('late unmounted registry response cannot replace a newer mount', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    let calls = 0;
    (window as any).releaseRegistry = null;
    (window as any).deferRegistry = false;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/aethergrid/runtime/providers')) {
        const reply = (provider: string) => new Response(JSON.stringify({ weather: { provider, status: 'ready' } }), { headers: { 'Content-Type': 'application/json' } });
        // The hidden system panel also checks readiness at startup. Arm the
        // delayed request only after opening Settings, not by global call order.
        if (!(window as any).deferRegistry) return Promise.resolve(reply('startup-registry'));
        calls += 1;
        if (calls === 1) return new Promise<Response>((resolve) => {
          (window as any).releaseRegistry = () => resolve(reply('obsolete-registry-A'));
        });
        return Promise.resolve(reply('current-registry-B'));
      }
      return original(input, init);
    }) as typeof window.fetch;
  });
  await page.route('**/api/aethergrid/runtime', (route) => route.fulfill({ json: {} }));
  await page.goto('/');
  await page.getByRole('button', { name: 'SETTINGS', exact: true }).click();
  await page.evaluate(() => { (window as any).deferRegistry = true; });
  await page.getByRole('button', { name: 'DEVELOPER / DIAGNOSTICS', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).releaseRegistry))).toBe(true);
  await expect(page.getByRole('button', { name: 'Refresh provider connections' })).toBeDisabled();
  await page.getByRole('button', { name: 'APPEARANCE', exact: true }).click();
  await page.getByRole('button', { name: 'DEVELOPER / DIAGNOSTICS', exact: true }).click();
  const center = page.locator('.provider-connection-center:visible');
  await expect(center).toContainText('current-registry-B');
  await page.evaluate(async () => { (window as any).releaseRegistry(); await new Promise(requestAnimationFrame); });
  await expect(center).not.toContainText('obsolete-registry-A');
  await expect(center).toContainText('current-registry-B');
  await expect(center.getByRole('alert')).not.toBeVisible();
});

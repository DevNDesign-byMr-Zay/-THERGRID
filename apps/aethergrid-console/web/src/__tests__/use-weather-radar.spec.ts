import { expect, test } from '@playwright/test';

test('radar publishes observed frames, pauses playback, and withholds overlays outside live mode', async ({ page }) => {
  await page.clock.install();
  let requests = 0;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/aethergrid/weather/radar', route => { requests++; return route.fulfill({ json: {
    frames: [{ time: '2026-10-29T12:00:00Z', urlTemplate: '/radar/one' }, { time: '2026-10-29T12:05:00Z', urlTemplate: '/radar/two' }],
    fetchedAt: '2026-10-29T12:06:00Z', stale: false, maximumLevel: 12, attribution: 'Fixture observations',
  } }); });
  await page.goto('/tests/hook-harness.html?hook=radar');
  await expect(page.getByText('Radar ready')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarSnapshot?.eventTime)).toBe('2026-10-29T12:05:00Z');
  expect(await page.evaluate(() => (window as any).hook.radarPlaying)).toBe(false);
  await page.evaluate(() => (window as any).hook.setRadarFrame(0));
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarSnapshot?.eventTime)).toBe('2026-10-29T12:00:00Z');
  await page.clock.runFor(300_000);
  await expect.poll(() => requests).toBe(2);
  await page.evaluate(() => (window as any).update({ mode: 'historical' }));
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarSnapshot)).toBe(null);
  expect(await page.evaluate(() => (window as any).requests.every((request: any) => request.signal.aborted))).toBe(true);
  await page.clock.runFor(600_000);
  expect(requests).toBe(2);
});

test('radar failure remains visible and event listeners stop updating after unmount', async ({ page }) => {
  await page.route('**/api/aethergrid/weather/radar', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/tests/hook-harness.html?hook=radar');
  await expect(page.getByText('Radar ready')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarError)).toContain('unavailable');
  expect(await page.evaluate(() => (window as any).listenerCount('aethergrid:radar-error'))).toBe(1);
  await page.evaluate(() => (window as any).unmount());
  expect(await page.evaluate(() => (window as any).listenerCount('aethergrid:radar-error'))).toBe(0);
  expect(await page.evaluate(() => (window as any).requests.every((request: any) => request.signal.aborted))).toBe(true);
});

test('a pending radar response is aborted when live mode ends', async ({ page }) => {
  let release!: () => void;
  let settled = false;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/aethergrid/weather/radar', async route => {
    await pending;
    await route.fulfill({ json: { frames: [{ time: '2026-10-29T12:00:00Z', urlTemplate: '/late' }], stale: false } }).catch(() => {});
    settled = true;
  });
  try {
    await page.goto('/tests/hook-harness.html?hook=radar');
    await expect(page.getByText('Radar ready')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).requests.length)).toBe(1);
    expect(await page.evaluate(() => (window as any).requests[0].signal.aborted)).toBe(false);
    await page.evaluate(() => (window as any).update({ mode: 'historical' }));
    await expect.poll(() => page.evaluate(() => (window as any).requests[0].signal.aborted)).toBe(true);
    release();
    await expect.poll(() => settled).toBe(true);
    expect(await page.evaluate(() => [(window as any).hook.radarManifest, (window as any).hook.radarError])).toEqual([null, null]);
  } finally { release(); }
});

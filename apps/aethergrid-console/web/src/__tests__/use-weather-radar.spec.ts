import { expect, test } from '@playwright/test';

test('radar publishes observed frames, pauses playback, and withholds overlays outside live mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/aethergrid/weather/radar', route => route.fulfill({ json: {
    frames: [{ time: '2026-10-29T12:00:00Z', urlTemplate: '/radar/one' }, { time: '2026-10-29T12:05:00Z', urlTemplate: '/radar/two' }],
    fetchedAt: '2026-10-29T12:06:00Z', stale: false, maximumLevel: 12, attribution: 'Fixture observations',
  } }));
  await page.goto('/tests/hook-harness.html?hook=radar');
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarSnapshot?.eventTime)).toBe('2026-10-29T12:05:00Z');
  expect(await page.evaluate(() => (window as any).hook.radarPlaying)).toBe(false);
  await page.evaluate(() => (window as any).hook.setRadarFrame(0));
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarSnapshot?.eventTime)).toBe('2026-10-29T12:00:00Z');
  await page.evaluate(() => (window as any).update({ mode: 'historical' }));
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarSnapshot)).toBe(null);
});

test('radar failure remains visible and event listeners stop updating after unmount', async ({ page }) => {
  await page.route('**/api/aethergrid/weather/radar', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/tests/hook-harness.html?hook=radar');
  await expect.poll(() => page.evaluate(() => (window as any).hook.radarError)).toContain('unavailable');
  await page.evaluate(() => { (window as any).unmount(); window.dispatchEvent(new CustomEvent('aethergrid:radar-error', { detail: 'late error' })); });
  expect(await page.evaluate(() => (window as any).hook.radarError)).not.toBe('late error');
});

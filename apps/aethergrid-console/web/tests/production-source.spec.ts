import { expect, test } from '@playwright/test';
import { isolateBackgroundFeeds } from './helpers/isolate-background-feeds';

test.beforeEach(async ({ page }) => {
  await isolateBackgroundFeeds(page);
});

test('source presentation never promotes stale, static or unknown receipts to live', async () => {
  const path = '../src/services/source-presentation';
  const module = await import(path).catch(() => null);
  expect(module?.sourcePresentationState, 'source classifier is required').toBeInstanceOf(Function);
  const classify = module!.sourcePresentationState;
  for (const [input, expected] of [
    [{ live: true, stale: true }, 'stale'],
    [{ mapped: true, live: true }, 'mapped'],
    [{ simulated: true, stale: true }, 'simulated'],
    [{ live: true }, 'live'],
    [{ fallback: true }, 'fallback'],
    [{ loading: true }, 'loading'],
    [{ unavailable: true, live: true }, 'unavailable'],
    [{}, 'unavailable']
  ]) expect(classify(input)).toBe(expected);
});

test('mapped city topology is identified independently from live measurements', async ({ page }) => {
  await page.route('**/api/aethergrid/geospatial/city/**', (route) => route.fulfill({ json: {
      schemaVersion: 4,
      city: { id: 'new-york', name: 'New York', lat: 40.7549, lon: -73.984 },
      source: { live: true, provider: 'offline-contract-fixture', fetchedAt: '2026-10-11T00:00:00Z', upstreamTimestamp: '2026-10-10T23:00:00Z', attribution: 'Offline topology fixture' },
      buildings: [], powerAssets: [], powerLines: [], roads: [], waterAreas: [], waterways: [], coastlines: [], greenAreas: []
  } }));
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Product modes' }).getByRole('button', { name: 'GRID', exact: true }).click();
  await expect(page.locator('.source-badge')).toHaveAttribute('data-source-state', 'mapped');
  await expect(page.locator('.source-badge')).toContainText('MAPPED');
  await expect(page.locator('.source-badge')).toContainText('Offline topology fixture');
});

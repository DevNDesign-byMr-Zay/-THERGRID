import { expect, test } from '@playwright/test';
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAANUlEQVR4nO3OQQEAMAjEsGPKJmtykDgJyOCTGmjq9n9Z7GzOAQAAAAAAAAAAAAAAAAAAkmQA2SoCiJIRhTMAAAAASUVORK5CYII=',
  'base64',
);

test('compiled global and city views retain observed aircraft and animated radar in every visual mode', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const now = Date.now(),
    time = new Date(now).toISOString();
  let radarRequests = 0;
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(u.hostname)
      ? route.continue()
      : u.hostname === 'tilecache.rainviewer.com'
        ? route.fulfill({ contentType: 'image/png', body: pixel })
        : route.abort();
  });
  await page.route('**/api/aethergrid/**', (route) => {
    const u = new URL(route.request().url()),
      p = u.pathname;
    if (p.endsWith('/auth/session') || p.endsWith('/config/public') || p.endsWith('/profile'))
      return route.continue();
    if (p.endsWith('/domains/aviation/aircraft'))
      return route.fulfill({
        json: {
          data: {
            aircraft: [
              {
                id: 'abc123',
                icaoHex: 'abc123',
                callsign: 'TEST123',
                latitude: 40.7549,
                longitude: -73.984,
                geometricAltitudeMeters: 3000,
                barometricAltitudeMeters: 2900,
                trackDegrees: 90,
                observedAt: time,
                truthState: 'observed',
              },
            ],
            totalAircraft: 1,
          },
          receipt: {
            provider: 'acceptance-fixture',
            live: true,
            stale: false,
            sourceTime: time,
            fetchedAt: time,
            attribution: 'TEST FIXTURE — NOT LIVE DATA',
          },
        },
      });
    if (p.endsWith('/weather/radar')) {
      radarRequests++;
      return route.fulfill({
        json: {
          provider: 'rainviewer',
          generatedAt: time,
          fetchedAt: time,
          stale: false,
          maximumLevel: 7,
          attribution: 'TEST RADAR FIXTURE',
          attributionUrl: 'https://www.rainviewer.com/',
          coverage: 'partial',
          coverageUrl: 'https://tilecache.rainviewer.com/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png',
          frames: [0, 1].map((i) => ({
            time: new Date(now - (1 - i) * 600000).toISOString(),
            urlTemplate: `https://tilecache.rainviewer.com/v2/radar/fixture${i}/256/{z}/{x}/{y}/2/1_1.png`,
          })),
        },
      });
    }
    if (p.includes('/geospatial/city/'))
      return route.fulfill({
        json: {
          city: { id: 'new-york', lat: 40.7549, lon: -73.984 },
          source: {
            provider: 'acceptance-fixture',
            live: true,
            fetchedAt: time,
            attribution: 'TEST FIXTURE — NOT CITY ACCURACY EVIDENCE',
          },
          buildings: [
            {
              id: 'fixture-building',
              heightM: 60,
              heightSource: 'height',
              footprint: [
                [-60, -60],
                [60, -60],
                [60, 60],
                [-60, 60],
              ],
            },
          ],
          roads: [],
          powerAssets: [],
          powerLines: [],
          waterAreas: [],
          greenAreas: [],
        },
      });
    return route.fulfill({
      status: 503,
      json: { error: 'Unrelated source unavailable in acceptance fixture' },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
  await expect(page.locator('.aviation-scene-badge')).toContainText('1 AIRCRAFT');
  const radar = page.getByRole('region', { name: 'Weather radar' });
  await expect(radar).toHaveAttribute('data-source-state', 'observed');
  const before = await radar.getAttribute('data-radar-frame');
  await page.getByRole('button', { name: 'PLAY RADAR', exact: true }).click();
  await expect(radar).not.toHaveAttribute('data-radar-frame', before!);
  await page.getByRole('button', { name: 'PAUSE RADAR', exact: true }).click();
  await page.getByLabel('Focus observed aircraft').selectOption('abc123');
  await expect(page.getByRole('button', { name: 'RETURN TO VIEW', exact: true })).toBeVisible();
  await expect(page.locator('.journey-status')).toHaveCount(0, { timeout: 30000 });
  await page.getByRole('button', { name: 'RETURN TO VIEW', exact: true }).click();
  for (const scope of ['global', 'city']) {
    if (scope === 'city') {
      await page.getByRole('button', { name: 'Navigation and layers' }).click();
      await page
        .getByRole('navigation', { name: 'City targets' })
        .getByRole('button', { name: /NEW YORK/ })
        .click();
      await page.getByRole('button', { name: 'Close navigation drawer' }).click();
      await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count', '1');
    }
    for (const mode of [
      'SOLID',
      'WIREFRAME',
      'GRID',
      'XRAY',
      'HOLOGRAPHIC',
      'OPERATIONS',
      'REALITY',
    ]) {
      const b = page
        .getByRole('group', { name: 'Visual mode' })
        .getByRole('button', { name: mode, exact: true });
      await b.click();
      await expect(b).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
      await expect(radar).toHaveAttribute('data-source-state', 'observed');
    }
  }
  await page.setViewportSize({width:390,height:800});
  await page.getByText('LIVE WEATHER & AIR TRAFFIC',{exact:true}).click();
  await expect(radar).not.toBeVisible();
  await page.getByText('LIVE WEATHER & AIR TRAFFIC',{exact:true}).click();
  await expect(radar).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});
  expect(radarRequests).toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/live-map-city-mode-matrix.png' });
});

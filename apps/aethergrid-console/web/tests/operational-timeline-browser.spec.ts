import { expect, test, type Page } from '@playwright/test';

async function isolateTimelineContext(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
      ? route.continue()
      : route.abort('internetdisconnected');
  });
  await page.route('**/api/aethergrid/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/aethergrid/config/public' || path === '/api/aethergrid/profile') return route.continue();
    return route.fulfill({ status: 503, json: { error: 'Unrelated source unavailable in offline timeline contract' } });
  });
}

test('live time readout identifies UTC independently from browser locale', async ({ page }) => {
  await isolateTimelineContext(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: '4D time controls' }).locator('output')).toContainText('UTC');
});

async function cityForecast(page: Page, fail = false, stale = false) {
  await isolateTimelineContext(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/aethergrid/weather/current?**', (route) => route.fulfill(fail || stale ? { json: {
    source: { provider: 'offline-current-contract', live: true, modelTime: '2026-10-12T17:00:00Z', fetchedAt: '2026-10-12T17:00:01Z', attribution: 'OFFLINE OBSERVATION CONTRACT' },
    receipt: { provider: 'offline-current-contract', live: true, stale, fallback: false },
    utcOffsetSeconds: 0, current: { time: '2026-10-12T17:00:00Z', temperatureC: 37, weatherCode: 0, windSpeedKph: 5 }
  } } : { status: 503, json: { error: 'Current observations unavailable in forecast contract fixture' } }));
  await page.route('**/api/aethergrid/city-live?**', (route) => route.fulfill({ status: 503, json: { error: 'Live context unavailable in forecast contract fixture' } }));
  await page.route('**/api/aethergrid/weather/forecast?**', (route) => route.fulfill(fail ? { status: 503, json: { error: 'Forecast unavailable' } } : { json: {
    data: { timesteps: ['12:00','13:00','15:00'].map((time, index) => ({ time: `2026-10-11T${time}:00Z`, temperatureCelsius: [12,14,18][index], humidityPercent: 50, weatherCode: 1000, windSpeedKph: 5 })) },
    receipt: { provider: 'offline-time-contract', dataset: 'hourly', live: true, fallback: false, stale: false, modelRunAt: '2026-10-11T10:00:00Z', retrievedAt: '2026-10-11T11:30:00Z', attribution: 'OFFLINE TIMELINE CONTRACT — NOT LIVE WEATHER EVIDENCE' }
  } }));
  await page.route('**/api/aethergrid/geospatial/city/**', (route) => route.fulfill({ json: {
    city: { id: 'new-york', lat: 40.7549, lon: -73.984 }, source: { provider: 'offline-map-contract', live: true, attribution: 'OFFLINE TIMELINE CONTRACT' },
    buildings: [{ id: 'mapped-building', heightM: 40, heightSource: 'height', footprint: [[-30,-30],[30,-30],[30,30],[-30,30]] }], powerAssets: [], powerLines: [], roads: [], waterAreas: [], waterways: [], coastlines: [], greenAreas: []
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: /NEW YORK/ }).click();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count', '1', { timeout: 30000 });
}

test('compiled rail selects exact forecast samples, changes replay rate and stops at coverage end', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await cityForecast(page);
  const rail = page.getByRole('region', { name: '4D time controls' });
  await rail.getByRole('button', { name: 'FORECAST', exact: true }).click();
  await expect(rail.getByRole('combobox', { name: 'Forecast valid time' })).toBeEnabled();
  await expect(rail).toContainText('3 source samples');
  await expect(rail).toContainText('Gaps are not reconstructed');
  await rail.getByRole('button', { name: 'First source sample' }).click();
  await expect(rail.locator('output')).toHaveAttribute('data-cursor', '2026-10-11T12:00:00.000Z');
  await rail.getByRole('combobox', { name: 'Forecast valid time' }).focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(rail.locator('output')).toHaveAttribute('data-cursor', '2026-10-11T13:00:00.000Z');
  await rail.getByRole('combobox', { name: 'Replay speed' }).selectOption('86400');
  await rail.getByRole('button', { name: 'Play source samples' }).click();
  await expect(rail.locator('output')).toHaveAttribute('data-cursor', '2026-10-11T15:00:00.000Z');
  await expect(page.locator('.live-cluster')).toHaveAttribute('data-cursor', '2026-10-11T15:00:00.000Z');
  await expect(page.locator('.live-cluster')).toContainText('3:00:00 PM UTC');
  await expect(rail.getByRole('button', { name: 'Play source samples' })).toBeDisabled();
  const railBox = await rail.boundingBox();
  for (const selector of ['.scene-caption', '.viewport-status']) {
    const box = await page.locator(selector).boundingBox();
    expect(box && railBox && box.x < railBox.x + railBox.width && box.x + box.width > railBox.x && box.y < railBox.y + railBox.height && box.y + box.height > railBox.y, `${selector} must stay clear of time controls`).toBe(false);
  }
  await expect(rail.locator('output')).toContainText('UTC');
  await page.screenshot({ path: 'test-results/timeline-desktop-forecast.png' });
});

test('stale current weather retains its value with an explicit stale state', async ({ page }) => {
  test.setTimeout(90000);
  await cityForecast(page, false, true);
  await expect(page.locator('.weather-card')).toContainText('37.0°C');
  await expect(page.locator('.weather-card')).toHaveAttribute('data-source-state', 'stale');
  await expect(page.locator('.weather-card-head')).toContainText('STALE');
  await page.getByRole('button', { name: 'INTEL', exact: true }).click();
  await page.locator('.weather-card').scrollIntoViewIfNeeded();
  await expect(page.locator('.weather-card-head em')).toBeVisible();
  await page.screenshot({ path: 'test-results/timeline-stale-weather.png' });
});

test('forecast replay range selects returned endpoints and stops at the chosen end', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await cityForecast(page);
  const rail = page.getByRole('region', { name: '4D time controls' });
  await rail.getByRole('button', { name: 'FORECAST', exact: true }).click();
  await rail.getByRole('button', { name: 'First source sample' }).click();
  await rail.getByText('Forecast replay range', { exact: true }).click();
  await rail.getByRole('combobox', { name: 'Forecast range end' }).selectOption('2026-10-11T13:00:00.000Z');
  await rail.getByRole('combobox', { name: 'Replay speed' }).selectOption('86400');
  await rail.getByRole('button', { name: 'Play source samples' }).click();
  await expect(rail.locator('output')).toHaveAttribute('data-cursor', '2026-10-11T13:00:00.000Z');
  await expect(rail.getByRole('button', { name: 'Play source samples' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/timeline-desktop-range.png' });
});

test('mobile historical and failed forecast modes keep unavailable data visible and transport disabled', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await cityForecast(page, true);
  await expect(page.locator('.weather-card')).toContainText('37.0°C');
  const rail = page.getByRole('region', { name: '4D time controls' });
  await rail.getByRole('button', { name: 'HISTORICAL', exact: true }).click();
  await expect(rail).toContainText('Persisted observations unavailable');
  await expect(rail).toContainText('Historical building reconstruction unavailable');
  await expect(rail.getByRole('button', { name: 'Play source samples' })).toBeDisabled();
  await expect(rail.getByRole('slider', { name: 'Source sample index' })).toBeDisabled();
  await expect(page.locator('.forecast-scene-badge')).not.toBeVisible();
  await expect(page.locator('.weather-card')).not.toContainText('37.0°C');
  await expect(page.locator('.weather-card')).toHaveAttribute('data-source-state', 'unavailable');
  await page.screenshot({ path: 'test-results/timeline-mobile-historical.png' });
  await rail.getByRole('button', { name: 'FORECAST', exact: true }).click();
  await expect(rail).toContainText('HTTP 503');
  await expect(rail.getByRole('combobox', { name: 'Forecast valid time' })).toBeDisabled();
  const bounds = await rail.boundingBox();
  expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/timeline-mobile-unavailable.png' });
  await expect(rail.getByRole('button', { name: 'Retry forecast' })).toBeVisible();
  await page.route('**/api/aethergrid/weather/forecast?**', (route) => route.fulfill({ json: {
    data: { timesteps: [{ time: '2026-10-13T12:00:00Z', temperatureCelsius: 12 }] },
    receipt: { provider: 'retry-contract', live: true, fallback: false, attribution: 'OFFLINE RETRY CONTRACT' }
  } }));
  await rail.getByRole('button', { name: 'Retry forecast' }).click();
  await expect(rail.getByRole('combobox', { name: 'Forecast valid time' })).toBeEnabled();
  await expect(rail).toContainText('retry-contract');
});

test('city switching rejects a delayed previous-city forecast receipt', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await cityForecast(page);
  let release: () => void = () => {};
  const deferred = new Promise<void>((resolve) => { release = resolve; });
  let oldStarted = false;
  let completed: () => void = () => {};
  const oldCompleted = new Promise<void>((resolve) => { completed = resolve; });
  await page.route('**/api/aethergrid/weather/forecast?**', async (route) => {
    const old = Number(new URL(route.request().url()).searchParams.get('lat')) < 45;
    if (old) { oldStarted = true; await deferred; }
    try {
      await route.fulfill({ json: { data: { timesteps: [{ time: '2026-10-13T12:00:00Z', temperatureCelsius: 12 }] },
        receipt: { provider: old ? 'delayed-new-york' : 'current-london', live: true, fallback: false, attribution: 'OFFLINE RACE CONTRACT' } } });
    } catch { /* Aborted requests may no longer accept a route response. */ }
    finally { if (old) completed(); }
  });
  try {
    const rail = page.getByRole('region', { name: '4D time controls' });
    await rail.getByRole('button', { name: 'FORECAST', exact: true }).click();
    await expect.poll(() => oldStarted).toBe(true);
    await expect(rail.locator('.forecast-coverage')).toHaveAttribute('data-state', 'loading');
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: /LONDON/ }).click();
    await page.getByRole('button', { name: 'Close navigation drawer' }).click();
    await expect(rail).toContainText('current-london');
    release(); await oldCompleted;
    await expect(rail).toContainText('current-london');
    await expect(rail).not.toContainText('delayed-new-york');
  } finally { release(); }
});

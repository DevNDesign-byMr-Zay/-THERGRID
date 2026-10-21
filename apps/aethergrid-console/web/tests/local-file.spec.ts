import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

for (const width of [1366, 390]) test(`opening the packaged index file without a server renders the workspace at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://**/*', route => route.abort());
  await page.route('https://**/*', route => route.abort());
  const html = process.env.AETHERGRID_LOCAL_HTML || resolve('local-dist/index.html');
  await page.goto(pathToFileURL(html).href);
  await expect(page.getByRole('button', { name: 'Navigation and layers' })).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true');
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
  await expect(page.getByRole('status').filter({ hasText: 'Local file' })).toBeVisible();
  await expect(page.locator('#local-boot')).toHaveCount(0);
  if(width===390){await expect(page.locator('.live-scene-controls')).not.toHaveAttribute('open','');await expect(page.getByText('LIVE WEATHER & AIR TRAFFIC',{exact:true})).toBeVisible();}
  const logo = page.locator('img').first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await page.getByRole('button', { name: /^Appearance:/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: `test-results/local-globe-${width}.png` });
  for (const name of (width === 1366 ? ['NEW YORK', 'LONDON'] : ['NEW YORK'])) {
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Close navigation drawer' }).click();
    await expect.poll(async () => Number(await page.locator('.world-stage').getAttribute('data-source-building-count'))).toBeGreaterThan(100);
    await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
    await expect(page.locator('.journey-status')).toHaveCount(0, {timeout: 45000});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test-results/local-city-${name.replaceAll(' ', '-')}-${width}.png` });
  }
  await page.getByRole('button', { name: 'WIREFRAME', exact: true }).click();
  await expect(page.getByRole('button', { name: 'WIREFRAME', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('standalone public weather uses provider data while historical and private routes stay unavailable', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: {
    current: { time: '2026-10-14T20:00', temperature_2m: 18, apparent_temperature: 17, relative_humidity_2m: 60, is_day: 1, precipitation: 0, weather_code: 2, cloud_cover: 30, surface_pressure: 1015, wind_speed_10m: 12, wind_direction_10m: 180, wind_gusts_10m: 20 },
    hourly: { time: ['2026-10-14T20:00','2026-10-14T21:00'], temperature_2m: [18,17], relative_humidity_2m: [60,65], weather_code: [2,3], wind_speed_10m: [12,14] }
  } }));
  await page.route('https://earthquake.usgs.gov/**', route => route.fulfill({ json: { features: [] } }));
  await page.goto(pathToFileURL(process.env.AETHERGRID_LOCAL_HTML || resolve('local-dist/index.html')).href);
  const results = await page.evaluate(async () => {
    const current = await fetch('/api/aethergrid/weather/current?lat=40.75&lon=-73.98').then(r => r.json());
    const forecast = await fetch('/api/aethergrid/weather/forecast?lat=40.75&lon=-73.98').then(r => r.json());
    const history = await fetch('/api/aethergrid/weather/current?lat=40.75&lon=-73.98&at=2020-01-01').then(r => r.status);
    const privateAction = await fetch('/api/aethergrid/quantum/jobs',{method:'POST'}).then(r => r.status);
    return { current, forecast, history, privateAction };
  });
  expect(results.current.current.temperatureC).toBe(18);
  expect(results.current.current.weatherCodeSystem).toBe('wmo');
  expect(results.current.source.live).toBe(true);
  expect(results.forecast.data.hourly[1].temperatureC).toBe(17);
  expect(results.history).toBe(404);
  expect(results.privateAction).toBe(503);
});

test('every bundled city renders its own mapped district without a server', async ({ page }) => {
  test.setTimeout(360000);
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('http://**/*', route => route.abort());
  await page.route('https://**/*', route => route.abort());
  await page.goto(pathToFileURL(process.env.AETHERGRID_LOCAL_HTML || resolve('local-dist/index.html')).href);
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true');
  for (const name of ['NEW YORK','LONDON','TOKYO','DUBAI','SINGAPORE','SÃO PAULO','LAGOS','SYDNEY']) {
    await page.getByRole('button', { name: 'Navigation and layers' }).click();
    await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: new RegExp(name) }).click();
    await page.getByRole('button', { name: 'Close navigation drawer' }).click();
    await expect.poll(async () => Number(await page.locator('.world-stage').getAttribute('data-source-building-count'))).toBeGreaterThan(100);
    await expect(page.locator('.journey-status')).toHaveCount(0, {timeout:45000});
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer','cesium');
    await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
    const count = await page.locator('.world-stage').getAttribute('data-source-building-count');
    for (const mode of ['SOLID','WIREFRAME','HOLOGRAPHIC','XRAY','GRID','OPERATIONS','REALITY']) {
      const control = page.getByRole('group', {name:'Visual mode'}).getByRole('button', {name:mode,exact:true});
      await control.click();
      await expect(control).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('.world-stage')).toHaveAttribute('data-source-building-count',count!);
      await page.waitForTimeout(80);
      await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
    }
    await page.getByRole('group', {name:'Visual mode'}).getByRole('button', {name:'SOLID',exact:true}).click();
    await page.screenshot({ path: `test-results/local-district-${name.replaceAll(' ','-')}.png` });
  }
  expect(errors).toEqual([]);
});

test('standalone Cesium remains interactive while its optional Earth texture request is delayed', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let slowTextureRequest = false;
  await page.route('**/*earth-natural-earth*', async route => {
    slowTextureRequest = true;
    await new Promise(resolve => setTimeout(resolve, 12_000));
    await route.abort();
  });
  await page.route('http://**/*', route => route.abort());
  await page.route('https://**/*', route => route.abort());
  await page.goto(pathToFileURL(process.env.AETHERGRID_LOCAL_HTML || resolve('local-dist/index.html')).href);
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true', { timeout: 8_000 });
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer', 'cesium');
  expect(slowTextureRequest, 'the offline renderer must actually request the bundled Earth image').toBe(true);
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await page.getByRole('navigation', { name: 'City targets' }).getByRole('button', { name: /NEW YORK/ }).click();
  await expect.poll(
    async () => Number(await page.locator('.world-stage').getAttribute('data-source-building-count')),
    { timeout: 45_000 }
  ).toBeGreaterThan(100);
  await expect(page.locator('.cesium-widget-errorPanel')).toHaveCount(0);
});

import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

for (const width of [1366, 390]) test(`opening the packaged index file without a server renders the workspace at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://**/*', route => route.abort());
  await page.route('https://**/*', route => route.abort());
  const html = process.env.AETHERGRID_LOCAL_HTML || resolve('local-dist/index.html');
  await page.goto(pathToFileURL(html).href);
  await expect(page.getByRole('button', { name: 'Navigation and layers' })).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-renderer-ready', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Local file' })).toBeVisible();
  await expect(page.locator('#local-boot')).toHaveCount(0);
  const logo = page.locator('img').first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Navigation and layers' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Close navigation drawer' }).click();
  await page.getByRole('button', { name: /^Appearance:/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: `test-results/local-file-${width}.png` });
  expect(errors).toEqual([]);
});
